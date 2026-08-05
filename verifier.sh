#!/bin/bash
echo "=== Vérification de la structure du projet ==="
echo ""

erreur_trouvee=0

verifier_fichier() {
  if [ -f "$1" ]; then
    echo "✅ $1 existe"
  else
    echo "❌ $1 est MANQUANT"
    erreur_trouvee=1
  fi
}

verifier_contenu() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo "✅ $1 contient bien : $2"
  else
    echo "❌ $1 NE contient PAS : $2"
    erreur_trouvee=1
  fi
}

echo "--- Fichiers attendus ---"
verifier_fichier "src/server.js"
verifier_fichier "src/routes/auth.js"
verifier_fichier "src/routes/etablissements.js"
verifier_fichier "src/routes/comptes.js"
verifier_fichier "src/routes/classes.js"
verifier_fichier "src/utils/seed.js"
verifier_fichier "public/index.html"
verifier_fichier "public/inscription-enseignant.html"
verifier_fichier "public/tableau-super-admin.html"
verifier_fichier "public/js/commun.js"
verifier_fichier "public/css/styles.css"

echo ""
echo "--- Contenu attendu ---"
verifier_contenu "src/server.js" "express.static"
verifier_contenu "src/routes/auth.js" "/connexion"
verifier_contenu "public/index.html" "identifiant"

echo ""
echo "--- Vérification syntaxique JavaScript ---"
for fichier in src/server.js src/routes/*.js src/middleware/*.js src/utils/*.js; do
  if node --check "$fichier" 2>/tmp/erreur_syntaxe; then
    echo "✅ $fichier : syntaxe correcte"
  else
    echo "❌ $fichier : ERREUR de syntaxe"
    cat /tmp/erreur_syntaxe
    erreur_trouvee=1
  fi
done

echo ""
if [ $erreur_trouvee -eq 0 ]; then
  echo "🎉 Tout est en ordre !"
else
  echo "⚠️  Des problèmes ont été trouvés, regarde les ❌ ci-dessus."
fi
