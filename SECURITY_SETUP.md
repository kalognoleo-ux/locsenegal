# Sécurité LocSenegal — Configuration obligatoire

Après le déploiement des correctifs, suivez **toutes** ces étapes.

---

## 1. Régénérer les clés PayDunya

Les anciennes clés ont pu être exposées dans le dépôt. Dans [PayDunya](https://paydunya.com) :

1. Régénérez **Master Key**, **Private Key**, **Token**
2. Mettez à jour les variables Netlify (voir ci-dessous)
3. Ne commitez **jamais** les vraies clés dans Git

---

## 2. Compte de service Firebase (Admin SDK)

1. Firebase Console → ⚙️ Paramètres → **Comptes de service**
2. **Générer une nouvelle clé privée** (fichier JSON)
3. Netlify → **Environment variables** → ajoutez :

| Variable | Valeur |
|----------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Collez **tout** le contenu du JSON sur **une ligne** |
| `FIREBASE_PROJECT_ID` | `locsenegal-c51f3` |

---

## 3. Publier les règles Firestore

1. Firebase Console → **Firestore** → **Règles**
2. Copiez le contenu de `firestore.rules` à la racine du projet
3. **Publier**

Ou avec Firebase CLI :

```bash
firebase deploy --only firestore:rules
```

---

## 4. Variables Netlify complètes

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON compte de service (obligatoire) |
| `FIREBASE_PROJECT_ID` | ID projet Firebase |
| `PAYDUNYA_MASTER_KEY` | Clé maître PayDunya |
| `PAYDUNYA_PRIVATE_KEY` | Clé privée PayDunya |
| `PAYDUNYA_TOKEN` | Token PayDunya |
| `PAYDUNYA_MODE` | `test` ou `live` |
| `ADMIN_SETUP_SECRET` | Mot de passe fort pour la 1ère config admin |
| `URL` | URL du site (ex. `https://votre-site.netlify.app`) |

---

## 5. Créer le premier administrateur

1. Inscrivez-vous / connectez-vous sur le site
2. Ouvrez **`/setup-admin.html`**
3. Entrez le `ADMIN_SETUP_SECRET` configuré sur Netlify
4. **Déconnectez-vous et reconnectez-vous**
5. Accédez à **`/admin.html`**

> Changez `ADMIN_SETUP_SECRET` après utilisation (ou supprimez la page setup-admin.html en production).

---

## 6. Redéployer sur Netlify

Chaque push déclenche `npm install` puis le déploiement des fonctions.

Vérifiez les logs : **Functions** → `validate-payment`, `paydunya-webhook`.

---

## Ce qui est protégé maintenant

- Paiements : authentification Firebase + vérification PayDunya + anti-doublon
- Webhook : signature SHA-512 + reconfirmation API PayDunya
- Top / abonnements : écriture **uniquement** via Admin SDK (serveur)
- Admin : claim Firebase `admin` obligatoire
- Firestore : champs sensibles (`plan`, `top_annonce`, etc.) non modifiables par le client
