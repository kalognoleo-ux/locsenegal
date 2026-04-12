// Netlify Function — Création d'une facture PayDunya (Top Annonce)
// Accepte: phone, amount, method, userId, annonceId
// Retourne: redirectUrl + checkoutToken

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;

const PAYDUNYA_ENDPOINT = 'https://app.paydunya.com/api/v1/checkout-invoice/create';

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
    if (!PAYDUNYA_MASTER_KEY) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Clés PayDunya manquantes dans les paramètres Netlify" }) };
    }
    const { phone, amount, method, userId, annonceId } = JSON.parse(event.body || '{}');

    // ── Validation des paramètres ──
    if (!phone || phone.replace(/\s/g, '').length < 8) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Numéro de téléphone invalide (minimum 8 chiffres)' }),
      };
    }

    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount < 500) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Montant invalide (minimum 500 FCFA)' }),
      };
    }

    const validMethods = ['wave', 'orange', 'free'];
    if (!validMethods.includes(method)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Moyen de paiement invalide. Choisissez wave, orange ou free.' }),
      };
    }

    const siteUrl = process.env.URL || 'https://locsenegal.netlify.app';

    // ── URLs de retour ──
    // return_url inclut annonce_id + token PayDunya
    const returnUrl = annonceId
      ? `${siteUrl}/success.html?annonce_id=${annonceId}&checkout={token}`
      : `${siteUrl}/success.html?checkout={token}`;

    const cancelUrl = `${siteUrl}/index.html`;

    // ── Description lisible ──
    const methodLabel = method === 'wave' ? 'Wave' : method === 'orange' ? 'Orange Money' : 'Free Money';

    // ── Payload PayDunya checkout-invoice ──
    const invoiceData = {
      invoice: {
        total_amount: parsedAmount,
        description: `Top Annonce LocSenegal — 7 jours (${methodLabel})${annonceId ? ` · Annonce ${annonceId}` : ''}`,
      },
      store: {
        name: 'LocSenegal',
        tagline: 'Location immobilière au Sénégal',
        website_url: siteUrl,
        logo_url: `${siteUrl}/favicon.ico`,
      },
      actions: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        callback_url: `${siteUrl}/.netlify/functions/paydunya-webhook`,
      },
      custom_data: {
        userId: userId || 'anonymous',
        method,
        phone: phone.replace(/\s/g, ''),
        annonceId: annonceId || '',
        originalAmount: String(parsedAmount),
        type: 'top_annonce',
      },
    };

    // ── Headers d'authentification PayDunya V1 ──
    const paydunyaHeaders = {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
      'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
      'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
    };

    console.log(`🚀 Création facture PayDunya — annonceId: ${annonceId} | method: ${method} | amount: ${parsedAmount}`);

    // ── Appel API PayDunya ──
    const paydunyaResponse = await fetch(PAYDUNYA_ENDPOINT, {
      method: 'POST',
      headers: paydunyaHeaders,
      body: JSON.stringify(invoiceData),
    });

    const responseText = await paydunyaResponse.text();
    console.log('PayDunya status:', paydunyaResponse.status);
    console.log('PayDunya body:', responseText);

    let checkoutData;
    try {
      checkoutData = JSON.parse(responseText);
    } catch (e) {
      console.error('Parsing erreur PayDunya:', responseText);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Réponse invalide de PayDunya',
          details: responseText.substring(0, 300),
        }),
      };
    }

    if (checkoutData.response_code !== '00') {
      console.error('Erreur PayDunya:', checkoutData);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: checkoutData.response_text || 'Erreur lors de la création du paiement',
          details: checkoutData,
        }),
      };
    }

    console.log(`✅ Facture créée — token: ${checkoutData.token}`);

    // ── Retourner le lien de redirection ──
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        redirectUrl: checkoutData.response_text, // URL de paiement PayDunya
        checkoutToken: checkoutData.token,
        message: 'Redirection vers le paiement…',
      }),
    };

  } catch (error) {
    console.error('Erreur initiate-payment:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Erreur serveur inattendue',
        details: error.message,
      }),
    };
  }
};
