// Fonction Netlify pour initier un paiement PayDunya
// Authentification V1 via Master/Private Key et Token
const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY || 'KC6G-LNKI-CWUR-6LMA-W2LL';
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY || 'SOTG-LEUA-VFZG-WVJ7-COQF';
const PAYDUNYA_PUBLIC_KEY = process.env.PAYDUNYA_PUBLIC_KEY || 'BZIW-ECWZ-C84H-MTE7-N64Q';
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN || '3WHD-VXAM-R9Q3-MXSV-U2ME';
const PAYDUNYA_SECRET_KEY = process.env.PAYDUNYA_SECRET_KEY || 'EZFQ-LUMI-7ZD5-ECD5-GVXR';

const PAYDUNYA_ENDPOINT = 'https://app.paydunya.com/api/v1/checkouts/';

exports.handler = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { phone, amount, method, userId } = req.body;

    // ✅ Validation des paramètres
    if (!phone || phone.length < 6) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    if (!amount || amount < 500) {
      return res.status(400).json({ error: 'Montant invalide (min 500 FCFA)' });
    }

    const validMethods = ['wave', 'orange', 'free'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: 'Méthode de paiement invalide' });
    }

    // 📝 Préparer les données PayDunya
    const invoiceData = {
      invoice: {
        number: `TOP-${Date.now()}`, // Numéro unique de facture
        memo: `Top Annonce LocSenegal - 7 jours de visibilité`,
      },
      customer: {
        phone: phone,
        email: `user-${userId || 'anonymous'}@locsenegal.sn`,
      },
      items: [
        {
          name: 'Top Annonce (7 jours)',
          description: 'Boost votre annonce avec le Top Annonce pour 7 jours de visibilité maximale',
          quantity: 1,
          unit_price: amount,
        },
      ],
      total_amount: amount,
      description: `Activation du Top Annonce pour ${method === 'wave' ? 'Wave' : method === 'orange' ? 'Orange Money' : 'Free Money'}`,
      return_url: `${process.env.URL || 'https://locsenegal.netlify.app'}/top.html?status=success&checkout={checkout_token}`,
      cancel_url: `${process.env.URL || 'https://locsenegal.netlify.app'}/top.html?status=cancelled`,
      callback_url: `${process.env.URL || 'https://locsenegal.netlify.app'}/.netlify/functions/paydunya-webhook`,
      metadata: {
        userId,
        method,
        phone,
        originalAmount: amount,
      },
    };

    // 🔐 Headers d'authentification PayDunya V1
    const headers = {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
      'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
      'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN
    };

    // 🚀 Appel API PayDunya pour créer le checkout
    const paydunyaResponse = await fetch(PAYDUNYA_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(invoiceData),
    });

    if (!paydunyaResponse.ok) {
      const error = await paydunyaResponse.text();
      console.error('Erreur PayDunya:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de la création du lien de paiement',
        details: error 
      });
    }

    const checkoutData = await paydunyaResponse.json();

    // ✅ Retourner le lien de redirection
    return res.status(200).json({
      success: true,
      redirectUrl: checkoutData.response.checkout_url || checkoutData.checkout_url,
      checkoutToken: checkoutData.response.token || checkoutData.token,
      message: 'Redirigé vers le paiement...',
    });

  } catch (error) {
    console.error('Erreur initiate-payment:', error);
    return res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
