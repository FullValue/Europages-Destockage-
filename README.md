# Compack — Destock, Market et back-office

Un seul serveur Node, sans dépendance, et une seule base (`data/db.json`). Le stock est commun aux deux sites.

| Adresse | Rôle |
|---|---|
| http://localhost:5173/ | Page d'accueil (liens vers les 3 espaces) |
| http://localhost:5173/destock/ | **Compack Destock** : vente en gros, lots, demandes de devis |
| http://localhost:5173/market/ | **Compack Market** : boutique détail, panier, commande, suivi |
| http://localhost:5173/admin/ | **Back-office** : stock, commandes, devis, clients, messages |

## Lancer

```bash
npm start            # ou : node server.js   (PORT=8080 node server.js pour changer de port)
npm run seed         # réinitialise la base (63 lots Deal Stock + données de démo)
```

Mot de passe du back-office : il est fixé à la création de la base.

- Avec la variable `ADMIN_PASSWORD` : `ADMIN_PASSWORD="votre-mot-de-passe" npm run seed`. En hébergement, définissez-la avant le premier démarrage.
- Sans variable : un mot de passe aléatoire est généré et affiché **une seule fois** dans la console.

Vous pouvez ensuite le changer dans **Paramètres**. La base (`data/db.json`) n'est pas versionnée : elle est créée automatiquement au premier lancement.

## Modifier le back-office

Le back-office est une app React + Tailwind + [shadcn/ui](https://ui.shadcn.com) dans `admin-app/`. Le serveur sert sa version compilée, `public/admin/`. Après une modification :

```bash
npm --prefix admin-app install   # une seule fois
npm run build:admin
```

Pour ajouter un composant : `cd admin-app && npx shadcn@latest add <composant>`.

## Fonctionnement

- **Produits & stock** : une fiche produit porte le stock en unités et deux canaux.
  - *Destock* : référence de lot, unités par lot, prix du lot HT, statut.
  - *Market* : prix TTC, prix barré, mise en avant.
  Chaque canal s'active ou se coupe séparément.
- **Stock commun** : une commande Market déduit des unités. Si un lot de gros est entamé, Destock affiche le reliquat (« Lot partiel ») au prix unitaire du lot. Une annulation de commande restitue le stock, et tous les mouvements sont tracés (onglet Mouvements).
- **Destock** : le client envoie une demande de devis. Dans le back-office, on chiffre chaque lot puis on convertit la demande en commande, ce qui déduit le stock.
- **Market** : commande directe. Le paiement par carte est **simulé** (aucun prestataire branché). Le virement et le retrait au showroom passent la commande « en attente de paiement ».
- **Commandes** : statuts (en attente → confirmée → en préparation → expédiée → livrée / annulée), statut de paiement, n° de suivi, bon imprimable. Les commandes prises par téléphone se saisissent à la main.
- **Exports CSV** pour toutes les données (Paramètres).

## Avant une mise en ligne réelle

- Supprimer les données de démo (Paramètres → « Supprimer les données de démo »).
- Brancher un vrai paiement (Stripe, etc.) à la place de la carte simulée.
- Brancher l'envoi d'e-mails : aucun e-mail n'est envoyé aujourd'hui.
- Héberger derrière HTTPS et sauvegarder régulièrement `data/db.json` et `public/assets/uploads/`.
- Compléter les mentions légales et les CGV des deux sites.
