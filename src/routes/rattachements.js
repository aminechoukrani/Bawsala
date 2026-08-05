const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.post('/demander', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { etablissement_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO enseignant_etablissement (enseignant_id, etablissement_id, statut, initiee_par)
       VALUES (?, ?, 'en_attente', 'enseignant')
       ON DUPLICATE KEY UPDATE statut = 'en_attente', initiee_par = 'enseignant'`,
      [req.user.id, etablissement_id]
    );
    res.json({ message: 'Demande envoyée, en attente de confirmation par l\'admin' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/mes-etablissements', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id, e.nom, e.ville
       FROM enseignant_etablissement ee
       JOIN etablissements e ON e.id = ee.etablissement_id
       WHERE ee.enseignant_id = ? AND ee.statut = 'confirme'`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/en-attente', verifierToken, autoriserRoles('admin', 'super_admin'), async (req, res) => {
  const etablissementId = req.user.role === 'admin' ? req.user.etablissement_id : req.query.etablissement_id;
  try {
    const [rows] = await pool.query(
      `SELECT ee.id, e.nom, e.email, ee.created_at
       FROM enseignant_etablissement ee
       JOIN enseignants e ON e.id = ee.enseignant_id
       WHERE ee.etablissement_id = ? AND ee.statut = 'en_attente' AND ee.initiee_par = 'enseignant'`,
      [etablissementId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/statut', verifierToken, autoriserRoles('admin', 'super_admin'), async (req, res) => {
  const { statut } = req.body;
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

router.get('/confirmes', verifierToken, autoriserRoles('admin', 'super_admin'), async (req, res) => {
  const etablissementId = req.user.role === 'admin' ? req.user.etablissement_id : req.query.etablissement_id;
  if (!etablissementId) return res.status(400).json({ erreur: 'etablissement_id requis' });
  try {
    const [rows] = await pool.query(
      `SELECT ee.id AS rattachement_id, e.id AS enseignant_id, e.nom, e.email
       FROM enseignant_etablissement ee
       JOIN enseignants e ON e.id = ee.enseignant_id
       WHERE ee.etablissement_id = ? AND ee.statut = 'confirme'`,
      [etablissementId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/inviter', verifierToken, autoriserRoles('admin'), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erreur: 'email requis' });
  try {
    const [enseignants] = await pool.query('SELECT id FROM enseignants WHERE email = ?', [email]);
    if (enseignants.length === 0) {
      return res.status(404).json({ erreur: "Aucun compte enseignant avec cet email. Il doit d'abord créer son compte." });
    }
    await pool.query(
      `INSERT INTO enseignant_etablissement
         (enseignant_id, etablissement_id, statut, initiee_par, accepte_par_enseignant, confirme_par_superadmin)
       VALUES (?, ?, 'en_attente', 'admin', FALSE, FALSE)
       ON DUPLICATE KEY UPDATE statut = 'en_attente', initiee_par = 'admin',
         accepte_par_enseignant = FALSE, confirme_par_superadmin = FALSE`,
      [enseignants[0].id, req.user.etablissement_id]
    );
    res.json({ message: "Invitation envoyée. En attente de l'acceptation de l'enseignant et de la confirmation du Super Admin." });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/invitations-envoyees', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ee.id, e.nom, e.email, ee.accepte_par_enseignant, ee.confirme_par_superadmin, ee.created_at
       FROM enseignant_etablissement ee
       JOIN enseignants e ON e.id = ee.enseignant_id
       WHERE ee.etablissement_id = ? AND ee.initiee_par = 'admin' AND ee.statut = 'en_attente'`,
      [req.user.etablissement_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/mes-invitations', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ee.id, et.nom AS etablissement_nom, ee.confirme_par_superadmin, ee.created_at
       FROM enseignant_etablissement ee
       JOIN etablissements et ON et.id = ee.etablissement_id
       WHERE ee.enseignant_id = ? AND ee.initiee_par = 'admin'
         AND ee.statut = 'en_attente' AND ee.accepte_par_enseignant = FALSE`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/accepter', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM enseignant_etablissement WHERE id = ? AND enseignant_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ erreur: 'Invitation introuvable' });

    const nouveauStatut = rows[0].confirme_par_superadmin ? 'confirme' : 'en_attente';
    await pool.query(
      'UPDATE enseignant_etablissement SET accepte_par_enseignant = TRUE, statut = ? WHERE id = ?',
      [nouveauStatut, req.params.id]
    );
    res.json({ message: 'Invitation acceptée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/attente-superadmin', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ee.id, e.nom AS enseignant_nom, e.email, et.nom AS etablissement_nom,
              ee.accepte_par_enseignant, ee.created_at
       FROM enseignant_etablissement ee
       JOIN enseignants e ON e.id = ee.enseignant_id
       JOIN etablissements et ON et.id = ee.etablissement_id
       WHERE ee.initiee_par = 'admin' AND ee.statut = 'en_attente' AND ee.confirme_par_superadmin = FALSE`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/confirmer-superadmin', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM enseignant_etablissement WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ erreur: 'Rattachement introuvable' });

    const nouveauStatut = rows[0].accepte_par_enseignant ? 'confirme' : 'en_attente';
    await pool.query(
      'UPDATE enseignant_etablissement SET confirme_par_superadmin = TRUE, statut = ? WHERE id = ?',
      [nouveauStatut, req.params.id]
    );
    res.json({ message: 'Confirmé par le Super Admin.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
