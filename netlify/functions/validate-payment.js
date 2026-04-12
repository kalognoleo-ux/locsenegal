// Netlify Function — Vérification paiement PayDunya + mise à jour Firestore
// Appelée depuis success.html après retour de PayDunya
// Accepte: token (checkout token), annonceId, userId
// Actions: vérifie le statut via API PayDunya + met à jour l'annonce dans Firestore

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'locsenegal-c51f3';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU';

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ── Mettre à jour le document annonce dans Firestore ──
async function activateTopAnnonce(annonceId) {
  if (!annonceId) {
    console.warn('⚠️ Pas d\'annonceId fourni — impossible de mettre à jour l\'annonce');
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

  console.log(`📝 Activation Top Annonce → annonces/${annonceId}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchData),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('❌ Erreur Firestore PATCH annonce:', err);
    return false;
  }

  console.log(`✅ Top Annonce activé pour annonces/${annonceId} — expire: ${expiry.toISOString()}`);
  return true;
}

// ── Enregistrer la transaction dans top_demandes ──
async function saveTopDemande({ token, annonceId, userId, amount }) {
  const timestamp = new Date().toISOString();
  const docData = {
    fields: {
      paymentToken: { stringValue: token || 'unknown' },
      annonceId: { stringValue: annonceId || '' },
      userId: { stringValue: userId || 'anonymous' },
      amount: { doubleValue: amount || 2000 },
      status: { stringValue: 'confirmed' },
      autoActivated: { booleanValue: true },
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
    console.warn('⚠️ Impossible d\'enregistrer dans top_demandes:', await response.text());
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
    const { token, annonceId, userId } = JSON.parse(event.body || '{}');

    if (!token) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Token de paiement manquant' }),
      };
    }

    console.log(`🔍 Vérification paiement PayDunya — token: ${token} | annonceId: ${annonceId}`);

    // ── Appel API PayDunya pour vérifier le statut ──
    const PAYDUNYA_MODE = (process.env.PAYDUNYA_MODE || 'test').toLowerCase();
    const BASE_URL = PAYDUNYA_MODE === 'test' 
      ? 'https://app.paydunya.com/sandbox-api/v1' 
      : 'https://app.paydunya.com/api/v1';
    
    const confirmUrl = `${BASE_URL}/checkout-invoice/confirm/${token}`;

    const paydunyaResponse = await fetch(confirmUrl, {
      method: 'GET',
      headers: {
        'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
      },
    });

    if (!paydunyaResponse.ok) {
      const errText = await paydunyaResponse.text();
      console.error('❌ Erreur API PayDunya confirm:', errText);
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Impossible de contacter PayDunya', details: errText }),
      };
    }

    const paydunyaData = await paydunyaResponse.json();
    console.log('📄 Statut PayDunya:', JSON.stringify(paydunyaData));

    const successStatuses = ['completed', 'success', 'approved', 'paid'];
    const isVerified = successStatuses.includes(String(paydunyaData.status || '').toLowerCase())
      || paydunyaData.response_code === '00';

    if (isVerified) {
      console.log('✅ Paiement confirmé par PayDunya');

      const amount = paydunyaData.invoice?.total_amount || 2000;

      // 1. Activer l'annonce dans Firestore
      await activateTopAnnonce(annonceId);

      // 2. Enregistrer la transaction
      const docId = await saveTopDemande({ token, annonceId, userId, amount });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          verified: true,
          message: 'Paiement confirmé — Top Annonce activé !',
          docId,
          annonceId,
        }),
      };
    } else {
      console.log(`ℹ️ Paiement non encore confirmé. Statut: ${paydunyaData.status}`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          verified: false,
          message: 'Paiement en cours de traitement — activation via webhook.',
          status: paydunyaData.status,
        }),
      };
    }

  } catch (error) {
    console.error('❌ Erreur validate-payment:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message }),
    };
  }
};
