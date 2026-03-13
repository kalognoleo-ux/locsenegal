# 🚀 Configuration Netlify Functions - Paiements

## ✅ Ce qui a été mis en place

### 1. **Fonction Netlify `validate-payment`**
- **Fichier** : `netlify/functions/validate-payment.js`
- **URL** : `https://your-site.netlify.app/.netlify/functions/validate-payment`
- **Rôle** : Valide et enregistre les demandes de paiement dans Firestore

### 2. **Tableau de bord Admin**
- **Fichier** : `admin.html`
- **Accès** : `/admin.html`
- **Rôle** : Permet à l'admin de confirmer ou rejeter les paiements

### 3. **Configuration automatique**
- **Fichier** : `netlify.toml` ✅ Créé
- **Variables d'env** : À configurer dans Netlify

---

## 📋 Étapes pour déployer sur Netlify

### **Étape 1 : Créer le site sur Netlify**
1. Aller sur **netlify.com**
2. Cliquer **"Add new site"** → **"Import an existing project"**
3. Sélectionner votre repo GitHub (`locsenegal`)
4. Build command: (laisser vide - c'est un site statique)
5. Publish folder: `.` (racine du dossier)
6. Cliquer **"Deploy"**

### **Étape 2 : Configurer les variables d'environnement**
1. Aller dans **Settings** → **Environment** → **Environment variables**
2. Ajouter ces variables :

| Variable | Valeur |
|----------|--------|
| `FIREBASE_PROJECT_ID` | `locsenegal-c51f3` |
| `FIREBASE_API_KEY` | `AIzaSyA8lP2C_4KP_djeKCCXp9vaL22Q6RhJGGU` |

3. Cliquer **"Save"**

### **Étape 3 : Redéployer**
- Aller dans **Deploys** → Cliquer **"Trigger deploy"** → Se créé

---

## 🔧 Comment ça fonctionne

### **Flux du paiement** :
```
1. Utilisateur envoie 2000 FCFA via Wave/Orange Money
2. Reçoit le code de confirmation par SMS
3. Entre le code sur /top.html
4. La fonction Netlify valide et enregistre dans Firestore
5. Admin reçoit la demande dans /admin.html
6. Admin confirme → Top Annonce activé
```

### **Fichiers créés** :
- ✅ `netlify.toml` — Configuration Netlify
- ✅ `netlify/functions/validate-payment.js` — Fonction de validation
- ✅ `admin.html` — Tableau de bord admin
- ✅ `.env.example` — Variables d'environnement (documentation)

### **Fichiers modifiés** :
- ✅ `top.html` — Intégration Netlify Functions au lieu de Firebase direct

---

## 🔐 Sécurité

⚠️ **À faire avant production** :

1. **Authentifier les admins**
   - Ajouter une vérification d'email admin dans `admin.html`
   - Ou utiliser Netlify Identity

2. **Firestore Règles** (dans Firebase Console) :
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /top_demandes/{id} {
      allow create: if true;
      allow read, update: if request.auth != null; // Admins seulement
    }
  }
}
```

3. **Limiter l'espace des fonctions** :
   - Netlify Functions sont gratuites jusqu'à 125K appels/mois
   - C'est suffisant pour une startup

---

## 📊 Prochaines étapes (optionnel)

Si vous voulez améliorer :
- Envoyer un SMS automatique au client avec le statut
- Créer une API webhook Wave/Orange pour les confirmations automatiques
- Ajouter un système de relance (email/SMS) si paiement non vérifié après 24h

---

## ❓ Support

**Erreur à la validation** ?
- Vérifier les variables d'env dans Netlify
- Vérifier que Firestore rules permettent `write` pour `top_demandes`
- Voir les logs : Netlify Dashboard → Functions → Logs

