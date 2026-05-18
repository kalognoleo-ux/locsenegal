# Configuration PayDunya pour LocSenegal

## Variables Netlify (jamais dans Git)

Configurez dans **Netlify Dashboard → Environment variables** :

```
PAYDUNYA_MASTER_KEY = (depuis le tableau de bord PayDunya)
PAYDUNYA_PRIVATE_KEY = (depuis le tableau de bord PayDunya)
PAYDUNYA_TOKEN = (depuis le tableau de bord PayDunya)
PAYDUNYA_MODE = test
```

En production : `PAYDUNYA_MODE=live`

## URL de callback (webhook)

Dans PayDunya → Webhooks / Notifications :

```
https://VOTRE-SITE.netlify.app/.netlify/functions/paydunya-webhook
```

Le webhook vérifie automatiquement la signature PayDunya (SHA-512) et reconfirme chaque paiement via l’API.

## Flux sécurisé

1. Utilisateur connecté → `initiate-payment` (token Firebase requis)
2. Paiement sur PayDunya
3. Webhook + `validate-payment` activent le Top via **Firebase Admin SDK**
4. Les règles Firestore empêchent toute activation manuelle côté client

Voir aussi : `SECURITY_SETUP.md`
