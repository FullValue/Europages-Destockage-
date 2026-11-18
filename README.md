# Compack — Destock, Market et back-office

Deux sites et un back-office sur une seule adresse, avec un stock commun. En local, la base est un fichier (`data/db.json`). Sur Vercel, c'est Postgres (voir plus bas).

| Adresse | Rôle |
|---|---|
| http://localhost:5173/ | Page d'accueil (liens vers les 3 espaces) |
| http://localhost:5173/destock/ | **Compack Destock** : vente en gros, lots, demandes de devis |
| http://localhost:5173/market/ | **Compack Market** : boutique détail, panier, commande, suivi |
| http://localhost:5173/admin/ | **Back-office** : stock, commandes, devis, clients, messages |

## Lancer

```bash
npm install          # une seule fois
npm start            # ou : node server.js   (PORT=8080 node server.js pour changer de port)
npm run seed         # réinitialise la base (63 lots Deal Stock + données de démo)
```

Mot de passe du back-office : il est fixé à la création de la base.

- Avec la variable `ADMIN_PASSWORD` : `ADMIN_PASSWORD="votre-mot-de-passe" npm run seed`. En hébergement, définissez-la avant le premier démarrage.
- Sans variable : un mot de passe aléatoire est généré et affiché **une seule fois** dans la console.

Vous pouvez ensuite le changer dans **Paramètres**. La base (`data/db.json`) n'est pas versionnée : elle est créée automatiquement au premier lancement.

## Mettre en ligne sur Vercel

1. **Importer le dépôt** dans Vercel (*Add New → Project*). Gardez les réglages proposés : `vercel.json` s'occupe de tout (preset « Other », pas de commande de build, dossier `public`).
2. **Ajouter une base Postgres** : onglet *Storage → Create Database → Neon (Postgres)*, puis reliez-la au projet. Vercel crée la variable `DATABASE_URL`. Elle est obligatoire, car le disque de Vercel n'est pas conservé.
3. **Ajouter Vercel Blob** pour les photos envoyées depuis l'admin : *Storage → Create → Blob*, relié au projet, qui crée `BLOB_READ_WRITE_TOKEN`.
4. **Variables d'environnement** (*Settings → Environment Variables*) :
   - `ADMIN_PASSWORD` : le mot de passe de l'admin. Il reste toujours valable, même après un changement dans Paramètres : c'est le mot de passe de secours.
   - `SESSION_SECRET` (conseillé) : une longue chaîne aléatoire qui signe les sessions.
5. **Redéployer** (*Deployments → Redeploy*) pour que les variables soient prises en compte.

Au premier appel, la base se remplit toute seule avec le catalogue et les données de démo. Adresses : `/destock/`, `/market/` et `/admin/` sur le même domaine.

Fonctionnement technique : les pages de `public/` sont servies telles quelles, et toutes les routes `/api/*` passent par une seule fonction (`api/handler.js` → `lib/app.js`). La base tient dans une ligne JSONB, verrouillée pendant chaque écriture, ce qui évite les stocks faux lors de commandes simultanées. Les photos sont réduites dans le navigateur (1600 px, JPEG) avant l'envoi, pour rester sous la limite de 4,5 Mo des fonctions Vercel.

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
- Sauvegarder régulièrement la base : la ligne `compack_store` dans Postgres, ou `data/db.json` en local.
- Compléter les mentions légales et les CGV des deux sites.
