# Configuration Netlify — LocSenegal

## Déploiement

1. Connectez le repo sur [netlify.com](https://netlify.com)
2. Build command : `npm install` (défini dans `netlify.toml`)
3. Publish directory : `.`

## Variables d'environnement obligatoires

Voir **`SECURITY_SETUP.md`** pour la liste complète.

Minimum :

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`
- `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`
- `PAYDUNYA_MODE` (`test` ou `live`)
- `ADMIN_SETUP_SECRET` (première configuration admin)

## Fonctions Netlify

| Fonction | Rôle | Auth |
|----------|------|------|
| `initiate-payment` | Créer facture Top Annonce | Firebase Bearer |
| `initiate-subscription` | Créer facture abonnement | Firebase Bearer |
| `validate-payment` | Confirmer paiement au retour | Firebase Bearer |
| `paydunya-webhook` | IPN PayDunya | Signature PayDunya |
| `activate-top-credit` | Utiliser un crédit Top | Firebase Bearer |
| `admin-payment-action` | Confirmer/rejeter (admin) | Admin claim |
| `grant-admin` | Attribuer le rôle admin (1×) | Secret + Bearer |

## Sécurité

Consultez **`SECURITY_SETUP.md`** avant la mise en production.
