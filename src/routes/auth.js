const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../config/db');
require('dotenv').config();

function genererToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
}

// --- Connexion Élève : Massar + date de naissance ---
router.post('/login/eleve', async (req, res) => {
  const { massar_code, date_naissance } = req.body;
  if (!massar_code || !date_naissance) {
    return res.status(400).json({ erreur: 'massar_code et date_naissance requis' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, nom, prenom FROM eleves WHERE massar_code = ? AND date_naissance = ?',
      [massar_code, date_naissance]
    );
    if (rows.length === 0) {
      return res.status(401).json({ erreur: 'Identifiants incorrects' });
    }
    const eleve = rows[0];
    const token = genererToken({ id: eleve.id, role: 'eleve' });
    res.json({ token, utilisateur: { ...eleve, role: 'eleve' } });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// --- Connexion Enseignant / Admin / Super Admin : email + mot de passe ---
// role attendu dans le body: 'enseignant' | 'admin' | 'super_admin'
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  const tablesParRole = { enseignant: 'enseignants', admin: 'admins', super_admin: 'super_admins' };
  const table = tablesParRole[role];
  if (!table) return res.status(400).json({ erreur: 'Rôle invalide' });

  try {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
    if (rows.length === 0) return res.status(401).json({ erreur: 'Identifiants incorrects' });

    const utilisateur = rows[0];
    const motDePasseValide = await bcrypt.compare(password, utilisateur.password_hash);
    if (!motDePasseValide) return res.status(401).json({ erreur: 'Identifiants incorrects' });

    const payload = { id: utilisateur.id, role };
    if (role === 'admin') payload.etablissement_id = utilisateur.etablissement_id;

    const token = genererToken(payload);
    delete utilisateur.password_hash;
    res.json({ token, utilisateur: { ...utilisateur, role } });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
