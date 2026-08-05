// Script d'amorçage : crée le tout premier compte Super Admin.
// À lancer une seule fois, manuellement, depuis le terminal Codespaces :
//   node src/utils/seed.js "Ton Nom" ton.email@exemple.com "MotDePasseSolide123"
//
// Ce script n'est volontairement PAS une route API : créer un Super Admin
// ne doit jamais être accessible via une requête HTTP.

const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function creerSuperAdmin() {
  const [nom, email, motDePasse] = process.argv.slice(2);

  if (!nom || !email || !motDePasse) {
    console.error('Usage: node src/utils/seed.js "Nom" email@exemple.com "MotDePasse"');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(motDePasse, 10);
    await pool.query(
      'INSERT INTO super_admins (nom, email, password_hash) VALUES (?, ?, ?)',
      [nom, email, hash]
    );
    console.log(`Super Admin créé avec succès : ${email}`);
  } catch (err) {
    console.error('Erreur lors de la création du Super Admin :', err.message);
  } finally {
    await pool.end();
  }
}

creerSuperAdmin();