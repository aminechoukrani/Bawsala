# Catalogue des fonctionnalités — GestiTest & GestiClasse

Référence pour la reconstruction de Bawsala. Compilé à partir d'un audit complet des deux dépôts (aminechoukrani/gestitest, aminechoukrani/gesticlasse).

## GestiTest

### Connexion & assignation des tests
- Connexion élève : N° Massar + date de naissance
- Pool de versions fixes : l'enseignant pré-crée jusqu'à 6 versions par filière
- Assignation déterministe : `version = ((eleve.id - 1) % 6) + 1` — répartition équilibrée, pas aléatoire à chaque connexion
- Structure d'examen : 3 « parties », sauvegarde automatique par réponse, soumission unique (pas de re-soumission)

### Anti-triche
- Overlay d'avertissement visible à l'écran, avec compteur d'alertes cumulées
- **Monitoring en temps réel** via Server-Sent Events : dashboard enseignant montrant les élèves actifs en direct, mis à jour à chaque alerte
- Détection : `blur` (Alt+Tab), `visibilitychange` (changement d'onglet/appli), `pagehide` et `freeze` (mobile), PrintScreen (keyup), ratio de redimensionnement anormal (heuristique DevTools)
- Blocage : clic droit, copier/couper/coller, sélection de texte, raccourcis DevTools (F12, Ctrl+Shift+I/J/C), Ctrl+U/S/P
- **Filigrane (watermark)** : nom + massar de l'élève tuilé sur tout l'écran — dissuasion contre les photos d'écran

### Dashboard de correction enseignant
- Stats globales + par classe, filtres classe/statut/filière, recherche
- QCM corrigé automatiquement et instantanément
- Questions ouvertes : **correction assistée par IA** (Claude Haiku) avec prompt tolérant les équivalences (« Ctrl+Fin » = « Ctrl+End »), + **repli sans IA** par similarité textuelle (distance de Levenshtein + extraction de mots-clés)
- **Intégration croisée** : profil comportemental GestiClasse (points, cahier, remarques) affiché en parallèle pendant la correction
- Note totale calculée en temps réel

### Overrides administratifs
- Réinitialiser une soumission (efface les réponses, réouvre le test)
- Forcer la soumission d'un élève bloqué
- Liste des absents (jamais commencé) et « en cours » (commencé, pas soumis) — en direct
- Changer la version assignée à un élève (réinitialise sa tentative)

### Exports
- CSV, export stats dashboard, export complet
- PDF (Puppeteer) : sujet, fiches individuelles, récapitulatif classe, copies individuelles
- Import de notes externes

### Couplage GestiClasse → GestiTest
- Le flag `suspect_triche` (défini dans GestiClasse) est lu par GestiTest pour appliquer une correction IA plus stricte

## GestiClasse

### Authentification
- Connexion enseignant, connexion élève (massar + date de naissance)
- **Liens d'accès sans mot de passe** : token unique par élève, généré par l'enseignant, connexion automatique au clic (utile pour les élèves plus jeunes / friction réduite)
- Changement de mot de passe, vérification de session

### Élèves
- Import/export CSV
- **Points de comportement** (échelle 0–20), ajustements par delta, historique complet avec motif
- Flag `suspect_triche` (alimente GestiTest)
- Remarques libres (ajout/suppression)

### Cahier (contrôle du cahier)
- Vérification périodique par l'enseignant : exercices faits, pages complétées, propreté
- Applique automatiquement un delta de points et l'enregistre dans le même historique que les ajustements manuels

### Workflow de modifications (élève → enseignant)
- L'élève soumet une demande de changement (ex. changement de classe) → en attente → l'enseignant approuve/refuse
- Override admin direct disponible en parallèle, sans passer par la file d'attente

### Workflow photos
- Même schéma : soumission → en attente → approuver/refuser, pour les photos de profil

---

## Décisions prises pour la version Bawsala unifiée

- **Connexion élève** : garder la connexion automatique après la 1ère tentative ; après un échec, exiger un clic explicite sur « Se connecter » pour les tentatives suivantes (évite qu'une correction de frappe ne compte comme une tentative échouée) ; verrouillage progressif (30s → 2min → 10min) plutôt qu'un blocage définitif ; ajouter le lien d'accès sans mot de passe (inspiré de GestiClasse) comme option alternative
- **Génération IA de DS** : plusieurs versions par niveau de difficulté (nombre choisi par l'enseignant à chaque fois), niveau de maîtrise calculé de façon unifiée par élève (méthode bootstrap : vitesse de complétion des cours, en attendant les quiz notés), variantes par élève combinant mélange de l'ordre ET reformulation IA, détection de changement d'onglet/appli avec avertissement immédiat + log
- **Coût IA** : plafond gratuit par enseignant, palier premium (payant, à intégrer plus tard) pour un usage illimité, compte super-admin (Amine) toujours illimité
- **Isolation multi-établissement** : audit de sécurité complet reporté à plus tard — pas urgent dans l'immédiat, mais à ne pas oublier avant une mise en production à grande échelle