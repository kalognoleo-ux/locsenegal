// Fonction Netlify pour recevoir les webhooks PayDunya
// Active le Top Annonce automatiquement après confirmation de paiement

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'locsenegal-c51f3';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // Gestion CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Méthode non autorisée' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    console.log('🔔 Webhook PayDunya reçu:', JSON.stringify(payload, null, 2));

    // PayDunya envoie: { data: { status, invoice, custom_data, ... } }
    const data = payload.data || payload;

    // Vérifier que c'est une confirmation de paiement
    const status = data.status || data.response_code;
    if (!status) {
      console.warn('❌ Payload webhook invalide — pas de status');
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Payload invalide' }),
      };
    }

    // ✅ Vérifier le status du paiement
    const successStatuses = ['completed', 'success', 'approved', 'paid'];
    const isSuccessful = successStatuses.includes(String(status).toLowerCase());

    if (!isSuccessful) {
      console.log(`ℹ️ Paiement non complété. Status: ${status}`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'Paiement non confirmé, ignoré',
          status,
        }),
      };
    }

    // 📥 Extraire les métadonnées (custom_data dans PayDunya)
    const customData = data.custom_data || data.metadata || {};
    const timestamp = new Date().toISOString();
    const invoiceToken = data.token || data.invoice?.token || 'unknown';

    // 🌟 GESTION ABONNEMENTS
    if (customData.type === 'subscription') {
      const { userId, planType } = customData;
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // Validité 30 jours
      
      let topCredits = 0;
      if (planType === 'proprietaire') topCredits = 1;
      if (planType === 'agence') topCredits = 999; // Agence illimité/prioritaire

      // Mise à jour de l'utilisateur dans Firestore
      const patchData = {
        fields: {
          plan: { stringValue: planType },
          planExpiry: { timestampValue: expiryDate.toISOString() },
          topAnnoncesCredits: { integerValue: topCredits }
        }
      };

      const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=plan&updateMask.fieldPaths=planExpiry&updateMask.fieldPaths=topAnnoncesCredits&key=${API_KEY}`;
      
      const patchResponse = await fetch(userUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      });

      if (!patchResponse.ok) {
        console.error('❌ Erreur Firestore pour Abonnement:', await patchResponse.text());
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Erreur enregistrement abonnement" }) };
      }

      console.log(`✅ Abonnement ${planType} activé pour l'utilisateur:`, userId);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, message: 'Abonnement activé' }) };
    }

    // 🌟 GESTION TOP ANNONCES CLASSIQUES (Existant)
    const { userId, method, phone } = customData;

    if (!phone || !method) {
      console.error('❌ Métadonnées manquantes pour Top Annonce:', customData);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Métadonnées incomplètes' }),
      };
    }

    // 📝 Créer un document pour enregistrer le paiement confirmé
    const topDemande = {
      fields: {
        status: { stringValue: 'confirmed' },
        method: { stringValue: method },
        phone: { stringValue: phone },
        userId: { stringValue: userId || 'anonymous' },
        paymentToken: { stringValue: invoiceToken },
        transactionId: { stringValue: data.invoice?.invoice_number || invoiceToken },
        amount: { doubleValue: data.invoice?.total_amount || 2000 },
        paidAt: { timestampValue: timestamp },
        createdAt: { timestampValue: timestamp },
        updatedAt: { timestampValue: timestamp },
        code: { stringValue: `AUTO-${invoiceToken.substring(0, 10)}` },
        autoActivated: { booleanValue: true },
      },
    };

    // 🚀 Envoyer à Firestore
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/top_demandes?key=${API_KEY}`;

    const firebaseResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topDemande),
    });

    if (!firebaseResponse.ok) {
      const error = await firebaseResponse.text();
      console.error('❌ Erreur Firestore:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Erreur lors de l'enregistrement", details: error }),
      };
    }

    const result = await firebaseResponse.json();
    const docId = result.name?.split('/').pop() || 'unknown';

    console.log('✅ Top Annonce activé automatiquement:', docId);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Top Annonce activé automatiquement',
        docId,
        status,
        phone,
      }),
    };
  } catch (error) {
    console.error('❌ Erreur webhook PayDunya:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Erreur serveur',
        details: error.message,
      }),
    };
  }
};
