// Netlify Function — Webhook PayDunya
// Reçoit les confirmations de paiement et active le Top Annonce dans Firestore
// Gère: top_annonce (classique) + abonnements (subscription)

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'locsenegal-c51f3';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ── Activer le Top Annonce sur l'annonce Firestore ──
async function activateTopAnnonce(annonceId) {
  if (!annonceId) {
    console.warn('⚠️ Webhook: pas d\'annonceId dans custom_data — Top Annonce non lié à une annonce');
    return false;
  }

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  const patchData = {
    fields: {
      top_annonce: { booleanValue: true },
      top_annonce_expire: { stringValue: expiry.toISOString() },
      top_annonce_activated_at: { stringValue: new Date().toISOString() },
    },
  };

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/annonces/${annonceId}?updateMask.fieldPaths=top_annonce&updateMask.fieldPaths=top_annonce_expire&updateMask.fieldPaths=top_annonce_activated_at&key=${API_KEY}`;

  console.log(`📝 Webhook: activation Top Annonce → annonces/${annonceId}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchData),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('❌ Webhook: Erreur Firestore PATCH annonce:', err);
    return false;
  }

  console.log(`✅ Webhook: Top Annonce activé — annonces/${annonceId} expire: ${expiry.toISOString()}`);
  return true;
}

// ── Enregistrer la transaction ──
async function saveTopDemande({ invoiceToken, annonceId, userId, method, phone, amount, transactionId }) {
  const timestamp = new Date().toISOString();

  const docData = {
    fields: {
      paymentToken: { stringValue: invoiceToken || 'unknown' },
      transactionId: { stringValue: transactionId || invoiceToken || 'unknown' },
      annonceId: { stringValue: annonceId || '' },
      userId: { stringValue: userId || 'anonymous' },
      method: { stringValue: method || 'unknown' },
      phone: { stringValue: phone || 'unknown' },
      amount: { doubleValue: amount || 2000 },
      status: { stringValue: 'confirmed' },
      autoActivated: { booleanValue: true },
      source: { stringValue: 'webhook' },
      createdAt: { timestampValue: timestamp },
      paidAt: { timestampValue: timestamp },
    },
  };

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/top_demandes?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData),
  });

  if (!response.ok) {
    console.warn('⚠️ Webhook: impossible d\'enregistrer top_demande');
    return null;
  }
  const result = await response.json();
  return result.name?.split('/').pop() || null;
}

exports.handler = async (event) => {
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

    // ── Vérifier le statut ──
    const status = data.status || data.response_code;
    if (!status) {
      console.warn('❌ Webhook: payload invalide — pas de status');
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Payload invalide — status manquant' }),
      };
    }

    const successStatuses = ['completed', 'success', 'approved', 'paid'];
    const isSuccessful = successStatuses.includes(String(status).toLowerCase());

    if (!isSuccessful) {
      console.log(`ℹ️ Webhook: paiement non complété. Status: ${status}`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Paiement non confirmé, ignoré', status }),
      };
    }

    // ── Extraire les métadonnées ──
    const customData = data.custom_data || data.metadata || {};
    const invoiceToken = data.token || data.invoice?.token || 'unknown';
    const transactionId = data.invoice?.invoice_number || invoiceToken;
    const amount = data.invoice?.total_amount || 2000;

    console.log(`✅ Webhook: paiement confirmé — token: ${invoiceToken} | type: ${customData.type}`);

    // ── GESTION ABONNEMENTS ──
    if (customData.type === 'subscription') {
      const { userId, planType } = customData;
      if (!userId || !planType) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Données abonnement manquantes' }) };
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      let topCredits = 0;
      if (planType === 'proprietaire') topCredits = 1;
      if (planType === 'agence') topCredits = 999;

      const patchData = {
        fields: {
          plan: { stringValue: planType },
          planExpiry: { timestampValue: expiryDate.toISOString() },
          topAnnoncesCredits: { integerValue: topCredits },
        },
      };

      const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=plan&updateMask.fieldPaths=planExpiry&updateMask.fieldPaths=topAnnoncesCredits&key=${API_KEY}`;

      const patchResponse = await fetch(userUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      });

      if (!patchResponse.ok) {
        console.error('❌ Webhook: Erreur Firestore abonnement:', await patchResponse.text());
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Erreur enregistrement abonnement' }) };
      }

      console.log(`✅ Webhook: Abonnement ${planType} activé pour ${userId}`);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, message: `Abonnement ${planType} activé` }) };
    }

    // ── GESTION TOP ANNONCE CLASSIQUE ──
    const { userId, method, phone, annonceId } = customData;

    // 1. ✅ Activer l'annonce dans Firestore (champ top_annonce + expiry)
    const activated = await activateTopAnnonce(annonceId || '');

    // 2. Enregistrer la transaction dans top_demandes
    const docId = await saveTopDemande({
      invoiceToken,
      transactionId,
      annonceId: annonceId || '',
      userId: userId || 'anonymous',
      method: method || 'unknown',
      phone: phone || 'unknown',
      amount,
    });

    console.log(`✅ Webhook complet — annonceActivated: ${activated} | docId: ${docId}`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Top Annonce activé via webhook',
        annonceId,
        activated,
        docId,
      }),
    };

  } catch (error) {
    console.error('❌ Erreur webhook PayDunya:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message }),
    };
  }
};
