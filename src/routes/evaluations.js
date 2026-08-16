const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles, autoriserAccesEvaluation } = require('../middleware/auth');

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

router.post('/', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { classe_id, titre, date_evaluation, duree_minutes } = req.body;
  if (!classe_id || !titre || !date_evaluation || !duree_minutes) {
    return res.status(400).json({ erreur: 'classe_id, titre, date_evaluation et duree_minutes requis' });
  }
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

router.get('/classe/:classeId', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM evaluations WHERE classe_id = ? ORDER BY date_evaluation DESC',
      [req.params.classeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/classe/:classeId/eleve', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id, e.titre, e.date_evaluation, e.duree_minutes, e.statut,
              n.note, n.publie,
              EXISTS(
                SELECT 1 FROM reponses_eleves r WHERE r.evaluation_id = e.id AND r.eleve_id = ?
              ) AS deja_soumis
       FROM evaluations e
       LEFT JOIN notes n ON n.evaluation_id = e.id AND n.eleve_id = ?
       WHERE e.classe_id = ?
       ORDER BY e.date_evaluation DESC`,
      [req.user.id, req.user.id, req.params.classeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// IMPORTANT : cette route doit rester AVANT "GET /:id" plus bas, sinon Express
// interprète "mes-evaluations" comme une valeur de :id et la mauvaise route répond.
router.get('/mes-evaluations', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, c.nom AS classe_nom,
              COUNT(DISTINCT r.eleve_id) AS nb_copies,
              COUNT(DISTINCT n.eleve_id) AS nb_notes_publiees
       FROM evaluations e
       JOIN classes c ON c.id = e.classe_id
       LEFT JOIN reponses_eleves r ON r.evaluation_id = e.id
       LEFT JOIN notes n ON n.evaluation_id = e.id AND n.publie = TRUE
       WHERE e.enseignant_id = ?
       GROUP BY e.id
       ORDER BY e.date_evaluation DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/timing', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  const { date_evaluation, duree_minutes } = req.body;
  if (!date_evaluation || !duree_minutes) return res.status(400).json({ erreur: 'date_evaluation et duree_minutes requis' });
  try {
    await pool.query(
      'UPDATE evaluations SET date_evaluation = ?, duree_minutes = ? WHERE id = ?',
      [date_evaluation, duree_minutes, req.params.id]
    );
    res.json({ message: 'Timing mis à jour' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/:id', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  try {
    const [questions] = await pool.query('SELECT * FROM questions WHERE evaluation_id = ? ORDER BY ordre', [req.params.id]);
    res.json({ ...req.evaluation, questions });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/:id/pour-eleve', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  try {
    const [evals] = await pool.query('SELECT id, classe_id, titre, date_evaluation, duree_minutes FROM evaluations WHERE id = ?', [req.params.id]);
    if (evals.length === 0) return res.status(404).json({ erreur: 'Évaluation introuvable' });
    const evaluation = evals[0];

    const [inscrit] = await pool.query('SELECT 1 FROM eleve_classe WHERE classe_id = ? AND eleve_id = ?', [evaluation.classe_id, req.user.id]);
    if (inscrit.length === 0) return res.status(403).json({ erreur: "Tu n'es pas inscrit dans cette classe" });

    const debut = new Date(evaluation.date_evaluation).getTime();
    const fin = debut + evaluation.duree_minutes * 60000;
    const maintenant = Date.now();
    const statutTemporel = maintenant < debut ? 'a_venir' : (maintenant > fin ? 'termine' : 'en_cours');

    const [dejaSoumis] = await pool.query(
      'SELECT 1 FROM reponses_eleves WHERE evaluation_id = ? AND eleve_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );

    const reponse = { ...evaluation, statut_temporel: statutTemporel, deja_soumis: dejaSoumis.length > 0, date_fin: new Date(fin).toISOString() };

    if (statutTemporel === 'en_cours' && dejaSoumis.length === 0) {
      const [questions] = await pool.query('SELECT id, enonce, type, ordre, parametres_variantes FROM questions WHERE evaluation_id = ? ORDER BY ordre', [req.params.id]);
      reponse.questions = questions.map(q => {
        let params = {};
        try { params = typeof q.parametres_variantes === 'string' ? JSON.parse(q.parametres_variantes) : (q.parametres_variantes || {}); } catch (e) { params = {}; }
        const paramsSansReponse = { ...params };
        delete paramsSansReponse.bonne_reponse_index;
        return { ...q, parametres_variantes: paramsSansReponse };
      });
    }

    res.json(reponse);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/:id/questions', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  const { enonce, type, ordre, options, bonne_reponse_index, code_initial } = req.body;
  if (!enonce || !type) return res.status(400).json({ erreur: 'enonce et type requis' });
  if (!['qcm', 'texte_libre', 'code'].includes(type)) return res.status(400).json({ erreur: 'type invalide' });

  try {
    let parametres = {};
    if (type === 'qcm') parametres = { options: options || [], bonne_reponse_index };
    if (type === 'code') parametres = { code_initial: code_initial || '' };

    const [result] = await pool.query(
      'INSERT INTO questions (evaluation_id, enonce, type, parametres_variantes, ordre) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, enonce, type, JSON.stringify(parametres), ordre || 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.delete('/:id/questions/:questionId', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  try {
    await pool.query('DELETE FROM questions WHERE id = ? AND evaluation_id = ?', [req.params.questionId, req.params.id]);
    res.json({ message: 'Question supprimée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

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

router.post('/:id/soumettre', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  const { reponses } = req.body;
  if (!Array.isArray(reponses) || reponses.length === 0) return res.status(400).json({ erreur: 'reponses requises' });

  try {
    const [dejaSoumis] = await pool.query(
      'SELECT 1 FROM reponses_eleves WHERE evaluation_id = ? AND eleve_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (dejaSoumis.length > 0) return res.status(409).json({ erreur: 'Tu as déjà soumis cette évaluation' });

    for (const r of reponses) {
      const suspect = (r.temps_reponse_secondes || 0) < 2;
      await pool.query(
        `INSERT INTO reponses_eleves
         (evaluation_id, eleve_id, question_id, reponse, temps_reponse_secondes, flag_suspect, raison_flag)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id, req.user.id, r.question_id, r.reponse, r.temps_reponse_secondes || 0,
          suspect, suspect ? 'Temps de réponse anormalement court' : null
        ]
      );
    }
    res.status(201).json({ message: 'Copie soumise' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/:id/copies', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  try {
    const [questions] = await pool.query('SELECT * FROM questions WHERE evaluation_id = ? ORDER BY ordre', [req.params.id]);
    const [reponses] = await pool.query(
      `SELECT r.*, el.nom, el.prenom FROM reponses_eleves r
       JOIN eleves el ON el.id = r.eleve_id
       WHERE r.evaluation_id = ?`,
      [req.params.id]
    );
    const [notes] = await pool.query('SELECT * FROM notes WHERE evaluation_id = ?', [req.params.id]);

    const eleveIds = [...new Set(reponses.map(r => r.eleve_id))];
    const copies = eleveIds.map(eleveId => {
      const reponsesEleve = reponses.filter(r => r.eleve_id === eleveId);
      let scoreQcmCorrect = 0;
      let totalQcm = 0;

      const detailReponses = questions.map(q => {
        const reponse = reponsesEleve.find(r => r.question_id === q.id);
        let params = {};
        try { params = typeof q.parametres_variantes === 'string' ? JSON.parse(q.parametres_variantes) : (q.parametres_variantes || {}); } catch (e) {}

        let correcte = null;
        if (q.type === 'qcm' && reponse) {
          totalQcm++;
          correcte = String(reponse.reponse) === String(params.bonne_reponse_index);
          if (correcte) scoreQcmCorrect++;
        }

        return {
          question_id: q.id, enonce: q.enonce, type: q.type,
          reponse: reponse ? reponse.reponse : null,
          correcte, flag_suspect: reponse ? !!reponse.flag_suspect : false
        };
      });

      const noteExistante = notes.find(n => n.eleve_id === eleveId);
      const infoEleve = reponsesEleve[0];

      return {
        eleve_id: eleveId, nom: infoEleve.nom, prenom: infoEleve.prenom,
        score_qcm: `${scoreQcmCorrect}/${totalQcm}`,
        reponses: detailReponses,
        note: noteExistante ? noteExistante.note : null,
        publie: noteExistante ? !!noteExistante.publie : false
      };
    });

    res.json(copies);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/notes/:eleveId', verifierToken, autoriserRoles('enseignant', 'super_admin'), chargerEvaluation, autoriserAccesEvaluation, async (req, res) => {
  const { note } = req.body;
  if (note === undefined) return res.status(400).json({ erreur: 'note requise' });
  try {
    await pool.query(
      `INSERT INTO notes (eleve_id, evaluation_id, note, publie)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE note = ?, publie = TRUE`,
      [req.params.eleveId, req.params.id, note, note]
    );
    res.json({ message: 'Note publiée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;