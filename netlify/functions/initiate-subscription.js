const { jsonResponse, handleOptions, requirePost, SITE_URL } = require('./lib/http');
const { verifyBearerToken } = require('./lib/auth');
const { PAYDUNYA_ENDPOINT, paydunyaHeaders, PAYDUNYA_MASTER_KEY } = require('./lib/paydunya');
const { PLANS } = require('./lib/constants');

exports.handler = async (event) => {
  const opt = handleOptions(event);
  if (opt) return opt;
  const methodErr = requirePost(event);
  if (methodErr) return methodErr;

  try {
    if (!PAYDUNYA_MASTER_KEY) {
      return jsonResponse(500, { error: 'Paiement temporairement indisponible.' });
    }

    const user = await verifyBearerToken(event);
    const { planType } = JSON.parse(event.body || '{}');

    if (!planType || !PLANS[planType]) {
      return jsonResponse(400, { error: 'Plan invalide.' });
    }

    const price = PLANS[planType].price;

    const invoiceData = {
      invoice: {
        total_amount: price,
        description: `Abonnement LocSenegal — ${PLANS[planType].label}`,
      },
      store: {
        name: 'LocSenegal',
        tagline: 'Location immobilière au Sénégal',
        website_url: SITE_URL,
      },
      actions: {
        return_url: `${SITE_URL}/dashboard.html?status=success`,
        cancel_url: `${SITE_URL}/tarifs.html?status=cancelled`,
        callback_url: `${SITE_URL}/.netlify/functions/paydunya-webhook`,
      },
      custom_data: {
        type: 'subscription',
        userId: user.uid,
        planType,
        userEmail: user.email || 'anonymous',
      },
    };

    const paydunyaResponse = await fetch(PAYDUNYA_ENDPOINT, {
      method: 'POST',
      headers: paydunyaHeaders(),
      body: JSON.stringify(invoiceData),
    });

    const responseText = await paydunyaResponse.text();
    let checkoutData;
    try {
      checkoutData = JSON.parse(responseText);
    } catch {
      return jsonResponse(502, { error: 'Réponse invalide du prestataire de paiement.' });
    }

    if (checkoutData.response_code !== '00') {
      return jsonResponse(500, {
        error: checkoutData.response_text || 'Erreur lors de la création du paiement.',
      });
    }

    return jsonResponse(200, {
      success: true,
      paymentUrl: checkoutData.response_text,
      checkoutToken: checkoutData.token,
    });
  } catch (error) {
    const code = error.statusCode || 500;
    return jsonResponse(code, { error: error.message || 'Erreur serveur.' });
  }
};
