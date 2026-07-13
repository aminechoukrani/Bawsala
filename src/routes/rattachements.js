const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

// Un enseignant demande un rattachement à un établissement
router.post('/demander', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { etablissement_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO enseignant_etablissement (enseignant_id, etablissement_id, statut)
       VALUES (?, ?, 'en_attente')
       ON DUPLICATE KEY UPDATE statut = 'en_attente'`,
      [req.user.id, etablissement_id]
    );
    res.json({ message: 'Demande envoyée, en attente de confirmation par l\'admin' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Un admin liste les demandes en attente pour son établissement
router.get('/en-attente', verifierToken, autoriserRoles('admin', 'super_admin'), async (req, res) => {
  const etablissementId = req.user.role === 'admin' ? req.user.etablissement_id : req.query.etablissement_id;
  try {
    const [rows] = await pool.query(
      `SELECT ee.id, e.nom, e.email, ee.created_at
       FROM enseignant_etablissement ee
       JOIN enseignants e ON e.id = ee.enseignant_id
       WHERE ee.etablissement_id = ? AND ee.statut = 'en_attente'`,
      [etablissementId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Un admin confirme ou refuse un rattachement
router.patch('/:id/statut', verifierToken, autoriserRoles('admin', 'super_admin'), async (req, res) => {
  const { statut } = req.body; // 'confirme' | 'refuse'
  if (!['confirme', 'refuse'].includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide' });
  }
  try {
    await pool.query('UPDATE enseignant_etablissement SET statut = ? WHERE id = ?', [statut, req.params.id]);
    res.json({ message: `Rattachement ${statut}` });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
