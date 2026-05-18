const { jsonResponse, handleOptions, requirePost } = require('./lib/http');
const {
  parseWebhookBody,
  verifyPaydunyaHash,
  confirmInvoiceToken,
  isPaymentSuccessful,
} = require('./lib/paydunya');
const {
  isPaymentAlreadyProcessed,
  markPaymentProcessed,
  activateTopAnnonce,
  saveTopDemande,
  activateSubscription,
} = require('./lib/firestore');

async function processTopAnnonce({ token, customData, amount }) {
  const annonceId = customData.annonceId || customData.annonce_id;
  const userId = customData.userId || 'anonymous';

  if (!annonceId) {
    console.warn('Webhook top_annonce sans annonceId');
    return { ok: false, reason: 'annonceId manquant' };
  }

  if (await isPaymentAlreadyProcessed(token)) {
    return { ok: true, duplicate: true };
  }

  await activateTopAnnonce(annonceId);
  const docId = await saveTopDemande({
    paymentToken: token,
    transactionId: token,
    annonceId,
    userId,
    method: customData.method || 'unknown',
    phone: customData.phone || 'unknown',
    amount,
    status: 'confirmed',
    autoActivated: true,
    source: 'webhook',
    paidAt: new Date().toISOString(),
  });

  await markPaymentProcessed(token, {
    type: 'top_annonce',
    annonceId,
    userId,
    docId,
  });

  return { ok: true, annonceId, docId };
}

async function processSubscription({ token, customData }) {
  const { userId, planType } = customData;
  if (!userId || !planType) {
    return { ok: false, reason: 'données abonnement manquantes' };
  }

  const logId = `sub_${token}`;
  if (await isPaymentAlreadyProcessed(logId)) {
    return { ok: true, duplicate: true };
  }

  await activateSubscription(userId, planType);
  await markPaymentProcessed(logId, { type: 'subscription', userId, planType });

  return { ok: true, userId, planType };
}

exports.handler = async (event) => {
  const opt = handleOptions(event);
  if (opt) return opt;
  const methodErr = requirePost(event);
  if (methodErr) return methodErr;

  try {
    const webhookData = parseWebhookBody(event);
    if (!webhookData) {
      return jsonResponse(400, { error: 'Payload invalide.' });
    }

    if (webhookData.hash && !verifyPaydunyaHash(webhookData.hash)) {
      console.error('Webhook: signature PayDunya invalide');
      return jsonResponse(403, { error: 'Signature invalide.' });
    }

    const status = webhookData.status || webhookData.response_code;
    if (!isPaymentSuccessful(status, webhookData.response_code)) {
      return jsonResponse(200, { message: 'Paiement non confirmé, ignoré.', status });
    }

    const token =
      webhookData.token ||
      webhookData.invoice?.token ||
      webhookData.invoice_token;

    if (!token) {
      return jsonResponse(400, { error: 'Token de facture manquant.' });
    }

    // Double vérification via API PayDunya (anti-falsification)
    const confirmed = await confirmInvoiceToken(token);
    if (!isPaymentSuccessful(confirmed.status, confirmed.response_code)) {
      return jsonResponse(200, { message: 'Non confirmé par PayDunya.', status: confirmed.status });
    }

    const customData = confirmed.custom_data || webhookData.custom_data || {};
    const amount = confirmed.invoice?.total_amount || webhookData.invoice?.total_amount || 2000;
    const type = customData.type || 'top_annonce';

    let result;
    if (type === 'subscription') {
      result = await processSubscription({ token, customData });
    } else {
      result = await processTopAnnonce({ token, customData, amount });
    }

    return jsonResponse(200, { success: true, ...result });
  } catch (error) {
    console.error('paydunya-webhook:', error);
    return jsonResponse(500, { error: 'Erreur serveur.' });
  }
};
