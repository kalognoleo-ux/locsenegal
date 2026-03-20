// Fonction Netlify pour initier un paiement PayDunya
// Authentification V1 via Master/Private Key et Token
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
    const { phone, amount, method, userId } = JSON.parse(event.body || '{}');

    // ✅ Validation des paramètres
    if (!phone || phone.length < 6) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Numéro de téléphone invalide' }),
      };
    }

    if (!amount || amount < 500) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Montant invalide (min 500 FCFA)' }),
      };
    }

    const validMethods = ['wave', 'orange', 'free'];
    if (!validMethods.includes(method)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Méthode de paiement invalide' }),
      };
    }

    const siteUrl = process.env.URL || 'https://locsenegal.netlify.app';

    // 📝 Préparer les données PayDunya (format checkout-invoice)
    const invoiceData = {
      invoice: {
        total_amount: amount,
        description: `Top Annonce LocSenegal - 7 jours de visibilité (${method === 'wave' ? 'Wave' : method === 'orange' ? 'Orange Money' : 'Free Money'})`,
      },
      store: {
        name: 'LocSenegal',
        tagline: 'Location immobilière au Sénégal',
        website_url: siteUrl,
      },
      actions: {
        return_url: `${siteUrl}/top.html?status=success&checkout={token}`,
        cancel_url: `${siteUrl}/top.html?status=cancelled`,
        callback_url: `${siteUrl}/.netlify/functions/paydunya-webhook`,
      },
      custom_data: {
        userId: userId || 'anonymous',
        method,
        phone,
        originalAmount: String(amount),
      },
    };

    // 🔐 Headers d'authentification PayDunya V1
    const headers = {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
      'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
      'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
    };

    // 🚀 Appel API PayDunya pour créer le checkout
    const paydunyaResponse = await fetch(PAYDUNYA_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(invoiceData),
    });

    const responseText = await paydunyaResponse.text();
    console.log('PayDunya response status:', paydunyaResponse.status);
    console.log('PayDunya response body:', responseText);

    let checkoutData;
    try {
      checkoutData = JSON.parse(responseText);
    } catch (e) {
      console.error('Erreur parsing réponse PayDunya:', responseText);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Réponse invalide de PayDunya',
          details: responseText.substring(0, 200),
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

    // ✅ Retourner le lien de redirection
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        redirectUrl: checkoutData.response_text,
        checkoutToken: checkoutData.token,
        message: 'Redirigé vers le paiement...',
      }),
    };
  } catch (error) {
    console.error('Erreur initiate-payment:', error);
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
