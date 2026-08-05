const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.post('/admins', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  const { nom, email, password, etablissement_id } = req.body;
  if (!nom || !email || !password || !etablissement_id) {
    return res.status(400).json({ erreur: 'nom, email, password et etablissement_id requis' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO admins (etablissement_id, nom, email, password_hash) VALUES (?, ?, ?, ?)',
      [etablissement_id, nom, email, hash]
    );
    res.status(201).json({ id: result.insertId, nom, email, etablissement_id });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/enseignants/inscription', async (req, res) => {
  const { nom, email, password } = req.body;
  if (!nom || !email || !password) {
    return res.status(400).json({ erreur: 'nom, email et password requis' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO enseignants (nom, email, password_hash) VALUES (?, ?, ?)',
      [nom, email, hash]
    );
    res.status(201).json({ id: result.insertId, nom, email, message: 'Compte créé. Demande un rattachement à un établissement pour continuer.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé' });
    }
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/enseignants', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  const { nom, email, password, etablissement_id } = req.body;
  if (!nom || !email || !password || !etablissement_id) {
    return res.status(400).json({ erreur: 'nom, email, password et etablissement_id requis' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO enseignants (nom, email, password_hash) VALUES (?, ?, ?)',
      [nom, email, hash]
    );
    await pool.query(
      `INSERT INTO enseignant_etablissement (enseignant_id, etablissement_id, statut) VALUES (?, ?, 'confirme')`,
      [result.insertId, etablissement_id]
    );
    res.status(201).json({ id: result.insertId, nom, email });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé' });
    }
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/eleves', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { massar_code, nom, prenom, date_naissance, classe_id } = req.body;
  if (!massar_code || !nom || !prenom || !date_naissance || !classe_id) {
    return res.status(400).json({ erreur: 'massar_code, nom, prenom, date_naissance et classe_id requis' });
  }
  try {
    const [existant] = await pool.query('SELECT id FROM eleves WHERE massar_code = ?', [massar_code]);
    let eleveId;
    if (existant.length > 0) {
      eleveId = existant[0].id;
    } else {
      const [result] = await pool.query(
        'INSERT INTO eleves (massar_code, nom, prenom, date_naissance) VALUES (?, ?, ?, ?)',
        [massar_code, nom, prenom, date_naissance]
      );
      eleveId = result.insertId;
    }
    await pool.query(
      'INSERT IGNORE INTO eleve_classe (eleve_id, classe_id) VALUES (?, ?)',
      [eleveId, classe_id]
    );
    res.status(201).json({ id: eleveId, nom, prenom, classe_id });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
