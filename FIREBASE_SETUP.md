# 🔥 LocSenegal v2 — Guide de Configuration Firebase

## Ce que vous devez faire AVANT de déployer

---

## Étape 1 — Créer un projet Firebase (GRATUIT)

1. Allez sur **console.firebase.google.com**
2. Cliquez **"Ajouter un projet"**
3. Nom : `locsenegal` → Continuer
4. Désactivez Google Analytics (optionnel) → Créer le projet

---

## Étape 2 — Activer l'authentification

1. Dans le menu gauche → **Authentication** → Get Started
2. Onglet **Sign-in method** → Activez :
   - ✅ **Email/Password**
   - ✅ **Google**

---

## Étape 3 — Créer la base de données Firestore

1. Menu gauche → **Firestore Database** → Create database
2. Choisissez **"Start in test mode"** (pour commencer)
3. Région : **eur3** (Europe)

### Règles Firestore (collez ces règles) :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /annonces/{id} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /users/{userId} {
      allow read, create, delete: if request.auth != null && request.auth.uid == userId;
      // ⚠️ Autorise le webhook Netlify (qui utilise l'API REST sans être authentifié)
      // Note: Pour une sécurité maximale en production, utilisez 'firebase-admin' dans Netlify
      allow update: if true; 
    }
    match /top_demandes/{id} {
      allow create: if true;
      allow read: if request.auth != null;
      allow update: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## Étape 4 — Activer Firebase Storage (pour les photos)

1. Menu gauche → **Storage** → Get Started
2. Mode test → Suivant → Terminer

### Règles Storage :
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /annonces/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Étape 5 — Récupérer votre configuration

1. Dans Firebase Console → Icône ⚙️ → **Paramètres du projet**
2. Faites défiler vers le bas → Section **"Vos applications"**
3. Cliquez **"</ > Ajouter une application Web"**
4. Nom : `locsenegal-web` → Enregistrer
5. Copiez l'objet `firebaseConfig`

---

## Étape 6 — Coller la config dans vos fichiers

**Ouvrez chaque fichier HTML** et remplacez le bloc `firebaseConfig` :

```javascript
// AVANT (à remplacer)
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJECT.firebaseapp.com",
  projectId: "VOTRE_PROJECT_ID",
  storageBucket: "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

// APRÈS (votre vraie config Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXX",
  authDomain: "locsenegal-xxxxx.firebaseapp.com",
  projectId: "locsenegal-xxxxx",
  storageBucket: "locsenegal-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

**Fichiers à modifier :**
- index.html
- connexion.html
- inscription.html
- publication.html
- profil.html
- carte.html
- top.html
- deconnexion.html

---

## Étape 7 — Déployer sur Netlify

1. Glissez le dossier `locsenegal_v2` sur **netlify.com/drop**
2. Ou connectez votre GitHub pour un déploiement automatique
3. Votre site est en ligne en 30 secondes !

### Autoriser votre domaine Netlify dans Firebase :
1. Firebase Console → Authentication → Settings → **Authorized domains**
2. Ajoutez votre URL Netlify (ex: `locsenegal-xxx.netlify.app`)

---

## Ce qui fonctionne sans Firebase (mode démo)

Si Firebase n'est pas configuré, le site fonctionne avec des données démo :
- ✅ Affichage des annonces (données démo)
- ✅ Carte interactive Leaflet
- ✅ Filtres et recherche
- ❌ Inscription/Connexion (nécessite Firebase Auth)
- ❌ Publication d'annonces réelles (nécessite Firestore + Storage)

---

## Structure Firestore

### Collection `annonces`
```json
{
  "title": "Chambre meublée à Pikine",
  "type": "Chambre",
  "locality": "Pikine",
  "price": 20000,
  "contact": "77 123 4567",
  "desc": "Description...",
  "photos": ["https://..."],
  "img": "https://...",
  "equipements": ["Meublé", "Eau incluse"],
  "top": false,
  "views": 0,
  "userId": "uid_firebase",
  "createdAt": "timestamp"
}
```

### Collection `users`
```json
{
  "nom": "Mariama Ndiaye",
  "email": "m@example.com",
  "phone": "+221771234567",
  "role": "proprietaire",
  "createdAt": "timestamp"
}
```

---

## Coût Firebase

Le plan **Spark (gratuit)** inclut :
- ✅ 10 000 lectures/jour
- ✅ 20 000 écritures/jour  
- ✅ 1 GB Storage
- ✅ 10 000 authentifications/mois

C'est **largement suffisant** pour démarrer LocSenegal 🇸🇳
