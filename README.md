# Gestiplateforme

Plateforme e-learning multi-établissement avec suivi de progression (preuve
horodatée) et module DS/Évaluations à accès restreint (enseignant créateur +
super admin uniquement).

## Rôles
- **Super Admin** : accès total, tous établissements
- **Admin** (établissement) : gère enseignants/classes de son établissement,
  PAS d'accès au module DS/Évaluations
- **Enseignant** : gère ses classes, cours, évaluations (peut être rattaché à
  plusieurs établissements, sous confirmation de chaque admin)
- **Élève** : consulte cours, progression, passe les évaluations

## Démarrer avec GitHub Codespaces
1. Ouvrir ce repo → bouton **Code → Codespaces → Create codespace on main**
2. Le `devcontainer` installe Node, MariaDB, charge automatiquement le schéma
   (`database/schema.sql`) et les dépendances npm
3. Une fois prêt : `npm run dev`
4. Le port 3000 est forwardé automatiquement — l'URL de test apparaît dans
   l'onglet "Ports"

## Structure du projet
```
.devcontainer/     configuration Codespaces (Node + MariaDB auto)
database/
  schema.sql       schéma complet (établissements, rôles, cours, évaluations)
src/
  config/db.js     pool de connexion MariaDB
  middleware/auth.js  JWT + contrôle d'accès par rôle
  routes/
    auth.js            connexion (élève: Massar+naissance / autres: email+mdp)
    rattachements.js    demandes/confirmations enseignant ↔ établissement
    cours.js            modules, pages, progression (preuve horodatée)
    evaluations.js       DS/Évaluations — accès restreint
  server.js        point d'entrée
```

## Points de vigilance hérités de GestiClasse/GestiTest
- Une seule base de données, un seul système d'auth — pas de duplication
  entre deux apps séparées
- Le module DS/Évaluations vérifie systématiquement `autoriserAccesEvaluation`
  après avoir chargé l'évaluation — ne jamais l'omettre sur une nouvelle route
- Le contenu généré par IA (`genere_par_ia = TRUE`) n'est jamais visible aux
  élèves tant que `valide_par_enseignant = FALSE`

## Prochaines étapes
- Endpoints CRUD établissements/classes/comptes (super admin, admin)
- Génération PDF des attestations de progression
- Génération de contenu de cours par IA (brouillon à valider)
- Bloc éditeur de code exécutable dans les pages de cours
