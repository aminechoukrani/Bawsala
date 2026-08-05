const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../config/db');
require('dotenv').config();

function genererToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
}

router.post('/connexion', async (req, res) => {
  const { identifiant, secret } = req.body;
  if (!identifiant || !secret) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const messageErreurGenerique = { erreur: 'Identifiants incorrects' };
  const estEmail = identifiant.includes('@');

  try {
    if (estEmail) {
      const tablesParRole = [
        { table: 'super_admins', role: 'super_admin' },
        { table: 'admins', role: 'admin' },
        { table: 'enseignants', role: 'enseignant' }
      ];

      for (const { table, role } of tablesParRole) {
        const [rows] = await pool.query(`SELECT * FROM ${table} WHERE email = ?`, [identifiant]);
        if (rows.length > 0) {
          const valide = await bcrypt.compare(secret, rows[0].password_hash);
          if (valide) {
            const payload = { id: rows[0].id, role };
            if (role === 'admin') payload.etablissement_id = rows[0].etablissement_id;
            const token = genererToken(payload);
            delete rows[0].password_hash;
            return res.json({ token, utilisateur: { ...rows[0], role } });
          }
        }
      }
      return res.status(401).json(messageErreurGenerique);
    } else {
      const [rows] = await pool.query(
        'SELECT id, nom, prenom FROM eleves WHERE massar_code = ? AND date_naissance = ?',
        [identifiant, secret]
      );
      if (rows.length === 0) return res.status(401).json(messageErreurGenerique);
      const token = genererToken({ id: rows[0].id, role: 'eleve' });
      return res.json({ token, utilisateur: { ...rows[0], role: 'eleve' } });
    }
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
