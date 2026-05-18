const { jsonResponse, handleOptions, requirePost, SITE_URL } = require('./lib/http');
const { verifyBearerToken } = require('./lib/auth');
const { PAYDUNYA_ENDPOINT, paydunyaHeaders, PAYDUNYA_MASTER_KEY } = require('./lib/paydunya');
const { assertAnnonceOwner } = require('./lib/firestore');
const { TOP_ANNONCE_PRICE } = require('./lib/constants');

exports.handler = async (event) => {
  const opt = handleOptions(event);
  if (opt) return opt;
  const methodErr = requirePost(event);
  if (methodErr) return methodErr;

  try {
    if (!PAYDUNYA_MASTER_KEY) {
      return jsonResponse(500, { error: 'Paiement temporairement indisponible.' }, event);
    }

    const user = await verifyBearerToken(event);
    const { phone, method, annonceId } = JSON.parse(event.body || '{}');

    if (!annonceId) {
      return jsonResponse(400, { error: 'Identifiant annonce requis.' });
    }

    await assertAnnonceOwner(annonceId, user.uid);

    if (!phone || String(phone).replace(/\s/g, '').length < 8) {
      return jsonResponse(400, { error: 'Numéro de téléphone invalide.' });
    }

    const validMethods = ['wave', 'orange', 'free'];
    if (!validMethods.includes(method)) {
      return jsonResponse(400, { error: 'Moyen de paiement invalide.' });
    }

    const parsedAmount = TOP_ANNONCE_PRICE;
    const methodLabel =
      method === 'wave' ? 'Wave' : method === 'orange' ? 'Orange Money' : 'Free Money';

    const returnUrl = `${SITE_URL}/success.html?annonce_id=${encodeURIComponent(annonceId)}&checkout={token}`;
    const invoiceData = {
      invoice: {
        total_amount: parsedAmount,
        description: `Top Annonce LocSenegal — 7 jours (${methodLabel}) · ${annonceId}`,
      },
      store: {
        name: 'LocSenegal',
        tagline: 'Location immobilière au Sénégal',
        website_url: SITE_URL,
      },
      actions: {
        return_url: returnUrl,
        cancel_url: `${SITE_URL}/index.html`,
        callback_url: `${SITE_URL}/.netlify/functions/paydunya-webhook`,
      },
      custom_data: {
        type: 'top_annonce',
        userId: user.uid,
        method,
        phone: String(phone).replace(/\s/g, ''),
        annonceId,
        originalAmount: String(parsedAmount),
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
      redirectUrl: checkoutData.response_text,
      checkoutToken: checkoutData.token,
    });
  } catch (error) {
    const code = error.statusCode || 500;
    if (code < 500) console.warn('initiate-payment:', error.message);
    else console.error('initiate-payment:', error);
    return jsonResponse(code, { error: error.message || 'Erreur serveur.' });
  }
};
