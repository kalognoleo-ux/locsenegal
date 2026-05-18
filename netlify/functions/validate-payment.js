const { jsonResponse, handleOptions, requirePost } = require('./lib/http');
const { verifyBearerToken } = require('./lib/auth');
const { confirmInvoiceToken, isPaymentSuccessful } = require('./lib/paydunya');
const {
  assertAnnonceOwner,
  isPaymentAlreadyProcessed,
  markPaymentProcessed,
  activateTopAnnonce,
  saveTopDemande,
} = require('./lib/firestore');

exports.handler = async (event) => {
  const opt = handleOptions(event);
  if (opt) return opt;
  const methodErr = requirePost(event);
  if (methodErr) return methodErr;

  try {
    const user = await verifyBearerToken(event);
    const { token, annonceId } = JSON.parse(event.body || '{}');

    if (!token) {
      return jsonResponse(400, { error: 'Token de paiement manquant.' });
    }
    if (!annonceId) {
      return jsonResponse(400, { error: 'Identifiant annonce requis.' });
    }

    await assertAnnonceOwner(annonceId, user.uid);

    if (await isPaymentAlreadyProcessed(token)) {
      return jsonResponse(200, {
        success: true,
        verified: true,
        message: 'Paiement déjà traité.',
        annonceId,
      });
    }

    const paydunyaData = await confirmInvoiceToken(token);
    const verified = isPaymentSuccessful(paydunyaData.status, paydunyaData.response_code);

    if (!verified) {
      return jsonResponse(200, {
        success: false,
        verified: false,
        message: 'Paiement en cours de traitement.',
        status: paydunyaData.status,
      });
    }

    const customData = paydunyaData.custom_data || {};
    const invoiceAnnonceId = customData.annonceId || customData.annonce_id;

    if (invoiceAnnonceId && invoiceAnnonceId !== annonceId) {
      return jsonResponse(403, {
        error: 'Cette facture ne correspond pas à cette annonce.',
      });
    }

    if (customData.userId && customData.userId !== user.uid) {
      return jsonResponse(403, { error: 'Paiement non associé à votre compte.' });
    }

    const amount = paydunyaData.invoice?.total_amount || 2000;
    await activateTopAnnonce(annonceId);
    const docId = await saveTopDemande({
      paymentToken: token,
      annonceId,
      userId: user.uid,
      amount,
      status: 'confirmed',
      autoActivated: true,
      source: 'validate-payment',
      paidAt: new Date().toISOString(),
    });

    await markPaymentProcessed(token, {
      type: 'top_annonce',
      annonceId,
      userId: user.uid,
      docId,
    });

    return jsonResponse(200, {
      success: true,
      verified: true,
      message: 'Paiement confirmé — Top Annonce activé !',
      annonceId,
    });
  } catch (error) {
    const code = error.statusCode || 500;
    console.error('validate-payment:', error.message);
    return jsonResponse(code, { error: error.message || 'Erreur serveur.' });
  }
};
