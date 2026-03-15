# Configuration PayDunya pour LocSenegal

## Vue d'ensemble du nouveau flux de paiement

✅ **Utilisateur** → Entre numéro + montant → **Redirection PayDunya** → Finalise dans Wave/Orange Money → **Webhook** → Top Annonce activé automatiquement

## Étapes de configuration

### 1️⃣ Créer un compte marchand PayDunya

1. Aller sur [PayDunya Sénégal](https://paydunya.com)
2. Créer un compte marchand
3. Vérifier votre compte (KYC)
4. Une fois approuvé, vous aurez accès au tableau de bord

### 2️⃣ Obtenir vos clés API

1. Dans le tableau de bord PayDunya, aller à **Paramètres** → **Clés API**
2. Vous aurez deux clés :
   - **API Key** (public)
   - **API Secret** (garder secret!)

### 3️⃣ Configurer les variables d'environnement dans Netlify

1. Aller dans **Netlify Dashboard** → Votre site → **Site settings** → **Build & deploy** → **Environment**
2. Ajouter les variables suivantes :

```
PAYDUNYA_MASTER_KEY = KC6G-LNKI-CWUR-6LMA-W2LL
PAYDUNYA_PRIVATE_KEY = SOTG-LEUA-VFZG-WVJ7-COQF
PAYDUNYA_PUBLIC_KEY = BZIW-ECWZ-C84H-MTE7-N64Q
PAYDUNYA_TOKEN = 3WHD-VXAM-R9Q3-MXSV-U2ME
PAYDUNYA_SECRET_KEY = EZFQ-LUMI-7ZD5-ECD5-GVXR
```

3. Cliquer sur "Save"

### 4️⃣ Configurer l'URL de callback dans PayDunya

1. Dans le tableau de bord PayDunya, aller à **Webhooks** ou **Paramètres de notification**
2. Ajouter cette URL comme callback pour les confirmations de paiement :

```
https://locsenegal.netlify.app/.netlify/functions/paydunya-webhook
```

### 5️⃣ Tester le flux complet

1. Aller sur la page `/top.html`
2. Entrer un numéro de téléphone et un montant
3. Vous serez redirigé vers PayDunya
4. Chercher l'option **Test Payment** ou utiliser les numéros de test fournis par PayDunya
5. Après confirmation, vous serez redirigé avec un message de succès

## Fonctionnalités implémentées

### ✅ Fonction `initiate-payment.js`
- Valide le numéro et montant
- Crée une facture PayDunya
- Retourne un lien de redirection sécurisé
- Passe les métadonnées (userId, method, phone)

### ✅ Fonction `paydunya-webhook.js`
- Reçoit les confirmations PayDunya
- Vérifie le statut du paiement
- **Active automatiquement** le Top Annonce dans Firestore
- Enregistre la transaction

### ✅ Modifications `top.html`
- Nouveau formulaire simplifié (numéro + montant)
- Détection du retour de PayDunya (statut success/cancelled)
- Messages de feedback en temps réel
- Redirection automatique au profil après succès

### ✅ Mise à jour `validate-payment.js`
- Support des statuts "confirmed" pour les paiements vérifiés
- Champ "verified" pour tracer la source de la vérification

## Montants suggérés

- **Minimum** : 500 F CFA
- **Top Annonce** : 2 000 F CFA (7 jours)
- **Super Top** : 5 000 F CFA (15 jours - à créer si souhaité)

## Frais PayDunya

PayDunya prend généralement **1-2%** de commission selon le montant et la méthode.

Exemple pour 2 000 F CFA :
- Commission estimée : 20-40 F CFA
- Montant net : 1 960-1 980 F CFA

## Support et troubleshooting

### Le webhook ne reçoit pas les notifications
- Vérifier que l'URL est bien configurée dans le tableau de bord PayDunya
- Vérifier les logs de la fonction `paydunya-webhook.js` dans Netlify
- S'assurer que le callback URL est **public** (pas en localhost)

### Les clés API ne fonctionnent pas
- Vérifier que les variables d'environnement sont bien définies
- Redéployer le site après ajouter les variables
- Vérifier que les clés ne contiennent pas d'espaces

### L'utilisateur ne revient pas après paiement
- S'assurer que les URLs de return sont correctes dans `initiate-payment.js`
- Vérifier que le cookie/session est conservé après redirection

## Prochaines étapes optionnelles

1. 📊 Ajouter un dashboard d'admin pour voir les paiements
2. 📧 Envoyer un email de confirmation au client
3. 💬 Notifications SMS automatiques via Twilio
4. 🔄 Système de renouvellement automatique du Top Annonce
5. 📈 Rapports de ventes et statistiques
