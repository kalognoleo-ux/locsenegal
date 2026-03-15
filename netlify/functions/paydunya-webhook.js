// Fonction Netlify pour recevoir les webhooks PayDunya
// Activates le Top Annonce automatiquement après confirmation de paiement

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'locsenegal-c51f3';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU';

const PAYDUNYA_SECRET_KEY = process.env.PAYDUNYA_SECRET_KEY || 'EZFQ-LUMI-7ZD5-ECD5-GVXR';

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
    const payload = req.body;

    console.log('🔔 Webhook PayDunya reçu:', JSON.stringify(payload, null, 2));

    // Vérifier que c'est une confirmation de paiement
    if (!payload.status || !payload.token || !payload.metadata) {
      console.warn('❌ Payload webhook invalide');
      return res.status(400).json({ error: 'Payload invalide' });
    }

    // ✅ Vérifier le status du paiement (généralement "completed" ou "success")
    const successStatuses = ['completed', 'success', 'approved', 'paid'];
    const isSuccessful = successStatuses.includes(payload.status?.toLowerCase());

    if (!isSuccessful) {
      console.log(`ℹ️ Paiement non complété. Status: ${payload.status}`);
      return res.status(200).json({ 
        message: 'Paiement non confirmé, ignoré',
        status: payload.status 
      });
    }

    // 📥 Extraire les métadonnées
    const metadata = payload.metadata || {};
    const { userId, method, phone } = metadata;

    if (!phone || !method) {
      console.error('❌ Métadonnées manquantes:', metadata);
      return res.status(400).json({ error: 'Métadonnées incomplètes' });
    }

    // 📝 Créer un document pour enregistrer le paiement confirmé
    const timestamp = new Date().toISOString();
    const topDemande = {
      fields: {
        status: { stringValue: 'confirmed' }, // ✅ Confirmé automatiquement
        method: { stringValue: method },
        phone: { stringValue: phone },
        userId: { stringValue: userId || 'anonymous' },
        paymentToken: { stringValue: payload.token || 'unknown' },
        transactionId: { stringValue: payload.invoice_number || payload.token },
        amount: { doubleValue: payload.amount || 2000 },
        paidAt: { timestampValue: timestamp },
        createdAt: { timestampValue: timestamp },
        updatedAt: { timestampValue: timestamp },
        code: { stringValue: `AUTO-${payload.token?.substring(0, 10)}` }, // Code auto-généré
        autoActivated: { booleanValue: true },
      },
    };

    // 🚀 Envoyer à Firestore
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/top_demandes?key=${API_KEY}`;

    const firebaseResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topDemande),
    });

    if (!firebaseResponse.ok) {
      const error = await firebaseResponse.text();
      console.error('❌ Erreur Firestore:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: error });
    }

    const result = await firebaseResponse.json();
    const docId = result.name?.split('/').pop() || 'unknown';

    console.log('✅ Top Annonce activé automatiquement:', docId);

    // ✅ Retourner une confirmation
    return res.status(200).json({
      success: true,
      message: 'Top Annonce activé automatiquement',
      docId,
      status: payload.status,
      phone,
    });

  } catch (error) {
    console.error('❌ Erreur webhook PayDunya:', error);
    return res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
