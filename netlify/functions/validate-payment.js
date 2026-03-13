// Fonction Netlify pour valider les paiements avec Firestore REST API

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'locsenegal-c51f3';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU';

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
    const { code, method, phone, userId } = req.body;

    // ✅ Validation du code
    if (!code || code.length < 6) {
      return res.status(400).json({ error: 'Code trop court (min 6 caractères)' });
    }

    // ✅ Validation de la méthode
    const validMethods = ['wave', 'orange', 'free'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: 'Méthode de paiement invalide' });
    }

    // ✅ Validation du téléphone
    if (!phone || phone.length < 6) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    // 📝 Préparer le document pour Firestore
    const timestamp = new Date().toISOString();
    const paymentData = {
      fields: {
        code: { stringValue: code.toUpperCase() },
        method: { stringValue: method },
        phone: { stringValue: phone },
        userId: { stringValue: userId || 'anonymous' },
        status: { stringValue: 'pending' },
        createdAt: { timestampValue: timestamp },
        updatedAt: { timestampValue: timestamp },
        ipAddress: { stringValue: req.headers['x-forwarded-for'] || req.ip || 'unknown' },
      },
    };

    // 🚀 Envoyer les données à Firestore via REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/top_demandes?key=${API_KEY}`;

    const firebaseResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData),
    });

    if (!firebaseResponse.ok) {
      const error = await firebaseResponse.text();
      console.error('Erreur Firestore:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
    }

    const result = await firebaseResponse.json();
    const docId = result.name?.split('/').pop() || 'unknown';

    // ✅ Succès
    return res.status(200).json({
      success: true,
      message: 'Demande reçue. Vérification en cours...',
      requestId: docId,
    });

  } catch (error) {
    console.error('Erreur validation:', error);
    return res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};
