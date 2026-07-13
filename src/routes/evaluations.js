const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles, autoriserAccesEvaluation } = require('../middleware/auth');

// Middleware : charge l'évaluation demandée et l'attache à req.evaluation
// (nécessaire avant autoriserAccesEvaluation, qui vérifie enseignant créateur / super_admin)
async function chargerEvaluation(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM evaluations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ erreur: 'Évaluation introuvable' });
    req.evaluation = rows[0];
    next();
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
}

// Créer une évaluation (enseignant uniquement)
router.post('/', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { classe_id, titre, date_evaluation, duree_minutes } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO evaluations (classe_id, enseignant_id, titre, date_evaluation, duree_minutes)
       VALUES (?, ?, ?, ?, ?)`,
      [classe_id, req.user.id, titre, date_evaluation, duree_minutes]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Consulter une évaluation — RESTREINT : enseignant créateur ou super_admin uniquement
// Les admins d'établissement n'ont PAS accès, même s'ils gèrent l'établissement de la classe
router.get('/:id', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  try {
    const [questions] = await pool.query('SELECT * FROM questions WHERE evaluation_id = ? ORDER BY ordre', [req.params.id]);
    res.json({ ...req.evaluation, questions });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Dashboard de supervision en direct — même restriction d'accès
router.get('/:id/supervision', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  try {
    const [reponses] = await pool.query(
      `SELECT r.eleve_id, el.nom, el.prenom, r.question_id, r.horodatage,
              r.temps_reponse_secondes, r.flag_suspect, r.raison_flag
       FROM reponses_eleves r
       JOIN eleves el ON el.id = r.eleve_id
       WHERE r.evaluation_id = ?
       ORDER BY r.horodatage DESC`,
      [req.params.id]
    );
    res.json(reponses);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Élève soumet une réponse pendant l'évaluation (flag automatique si temps anormalement court)
router.post('/:id/reponses', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  const { question_id, reponse, temps_reponse_secondes } = req.body;
  const SEUIL_SUSPECT_SECONDES = 3; // à ajuster : réponse quasi instantanée = suspect
  const suspect = temps_reponse_secondes < SEUIL_SUSPECT_SECONDES;

  try {
    await pool.query(
      `INSERT INTO reponses_eleves
       (evaluation_id, eleve_id, question_id, reponse, temps_reponse_secondes, flag_suspect, raison_flag)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, req.user.id, question_id, reponse, temps_reponse_secondes,
        suspect, suspect ? 'Temps de réponse anormalement court' : null
      ]
    );
    res.status(201).json({ message: 'Réponse enregistrée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
