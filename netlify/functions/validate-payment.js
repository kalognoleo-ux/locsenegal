// Fonction Netlify pour valider les paiements (Manuel ou PayDunya)
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'locsenegal-c51f3';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU';

// Clés PayDunya pour vérification serveur
const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

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
    const { token, code, method, phone, userId } = JSON.parse(event.body || '{}');
    let isVerified = false;
    let paymentStatus = 'pending';
    let transactionToken = token || code || 'unknown';

    // 1️⃣ CAS : Validation via TOKEN PayDunya (Automatique)
    if (token) {
      console.log(`🔍 Vérification du token PayDunya: ${token}`);
      const confirmUrl = `https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token}`;

      const paydunyaResponse = await fetch(confirmUrl, {
        method: 'GET',
        headers: {
          'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
          'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
          'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
        },
      });

      if (paydunyaResponse.ok) {
        const data = await paydunyaResponse.json();
        console.log('📄 Réponse PayDunya Status:', JSON.stringify(data));

        if (data.status === 'completed' || data.response_code === '00') {
          isVerified = true;
          paymentStatus = 'confirmed';
        }
      } else {
        console.error('❌ Erreur API PayDunya Status:', await paydunyaResponse.text());
      }
    }
    // 2️⃣ CAS : Validation via CODE (Manuel)
    else if (code && code.length >= 6) {
      console.log(`📝 Enregistrement manuel du code: ${code}`);
      paymentStatus = 'pending'; // Nécessite validation admin
    } else {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Token ou Code de validation manquant' }),
      };
    }

    // 📝 Préparer les données pour Firestore
    const timestamp = new Date().toISOString();
    const paymentData = {
      fields: {
        code: { stringValue: String(code || token || '').toUpperCase() },
        method: { stringValue: method || 'unknown' },
        phone: { stringValue: phone || 'unknown' },
        userId: { stringValue: userId || 'anonymous' },
        status: { stringValue: paymentStatus },
        createdAt: { timestampValue: timestamp },
        updatedAt: { timestampValue: timestamp },
        autoActivated: { booleanValue: isVerified },
      },
    };

    // Ajouter verifiedAt si vérifié
    if (isVerified) {
      paymentData.fields.verifiedAt = { timestampValue: timestamp };
    }

    // 🚀 Sauvegarde dans Firestore
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/top_demandes?key=${API_KEY}`;

    const firebaseResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData),
    });

    if (!firebaseResponse.ok) {
      const error = await firebaseResponse.text();
      console.error('❌ Erreur Firestore:', error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Erreur lors de l'enregistrement Firestore" }),
      };
    }

    const result = await firebaseResponse.json();
    const docId = result.name?.split('/').pop() || 'unknown';

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        verified: isVerified,
        message: isVerified
          ? 'Paiement confirmé et activé !'
          : 'Demande enregistrée, en attente de vérification.',
        docId,
      }),
    };
  } catch (error) {
    console.error('❌ Erreur validation-payment:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message }),
    };
  }
};
