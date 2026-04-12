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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  try {
    if (!PAYDUNYA_MASTER_KEY) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Clés PayDunya manquantes dans les paramètres Netlify" }) };
    }
    const { userId, userEmail, planType, price } = JSON.parse(event.body || '{}');

    if (!userId || !planType || !price) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Paramètres manquants' }) };
    }

    const siteUrl = process.env.URL || 'https://locsenegal.netlify.app';

    const invoiceData = {
      invoice: {
        total_amount: price,
        description: `Abonnement LocSenegal - Plan ${planType.toUpperCase()}`,
      },
      store: {
        name: 'LocSenegal',
        tagline: 'Location immobilière au Sénégal',
        website_url: siteUrl,
      },
      actions: {
        return_url: `${siteUrl}/dashboard.html?status=success&checkout={token}`,
        cancel_url: `${siteUrl}/tarifs.html?status=cancelled`,
        callback_url: `${siteUrl}/.netlify/functions/paydunya-webhook`,
      },
      custom_data: {
        type: 'subscription',
        userId: userId,
        planType: planType,
        userEmail: userEmail || 'anonymous'
      },
    };

    const headers = {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
      'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
      'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
    };

    const paydunyaResponse = await fetch(PAYDUNYA_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(invoiceData),
    });

    const responseText = await paydunyaResponse.text();
    let checkoutData;
    try { checkoutData = JSON.parse(responseText); } catch (e) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Réponse invalide de PayDunya' }) };
    }

    if (checkoutData.response_code !== '00') {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: checkoutData.response_text || 'Erreur création paiement' }) };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        paymentUrl: checkoutData.response_text,
        checkoutToken: checkoutData.token
      }),
    };
  } catch (error) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Erreur serveur', details: error.message }) };
  }
};
