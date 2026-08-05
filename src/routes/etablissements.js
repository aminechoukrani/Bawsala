const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.post('/', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  const { nom, ville } = req.body;
  if (!nom) return res.status(400).json({ erreur: 'Le nom est requis' });
  try {
    const [result] = await pool.query(
      'INSERT INTO etablissements (nom, ville) VALUES (?, ?)',
      [nom, ville || null]
    );
    res.status(201).json({ id: result.insertId, nom, ville });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM etablissements ORDER BY nom');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;