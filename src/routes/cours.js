const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

// Créer un module de cours (enseignant)
router.post('/modules', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { classe_id, titre, matiere, ordre } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO modules_cours (classe_id, enseignant_id, titre, matiere, ordre) VALUES (?, ?, ?, ?, ?)',
      [classe_id, req.user.id, titre, matiere || 'Informatique', ordre || 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Ajouter une page à un module (contenu manuel ou brouillon généré par IA à valider)
router.post('/modules/:moduleId/pages', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { titre, contenu_html, a_bloc_code_executable, ordre, genere_par_ia } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO pages_cours
       (module_id, titre, contenu_html, a_bloc_code_executable, ordre, genere_par_ia, valide_par_enseignant)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.moduleId, titre, contenu_html,
        !!a_bloc_code_executable, ordre || 0,
        !!genere_par_ia, genere_par_ia ? false : true // contenu IA doit être validé avant publication
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Enseignant valide une page générée par IA avant publication
router.patch('/pages/:pageId/valider', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    await pool.query('UPDATE pages_cours SET valide_par_enseignant = TRUE WHERE id = ?', [req.params.pageId]);
    res.json({ message: 'Page validée et publiée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Élève consulte une page (uniquement si validée) et son ouverture est journalisée
router.get('/pages/:pageId', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  try {
    const [pages] = await pool.query(
      'SELECT * FROM pages_cours WHERE id = ? AND valide_par_enseignant = TRUE',
      [req.params.pageId]
    );
    if (pages.length === 0) return res.status(404).json({ erreur: 'Page introuvable ou non publiée' });

    // Journalisation de la première vue (preuve horodatée)
    await pool.query(
      `INSERT INTO progression (eleve_id, page_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE derniere_vue_at = CURRENT_TIMESTAMP`,
      [req.user.id, req.params.pageId]
    );

    res.json(pages[0]);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Élève met à jour le temps passé / complétion du défi sur une page
router.patch('/pages/:pageId/progression', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  const { temps_passe_secondes, defi_complete, score_defi } = req.body;
  try {
    await pool.query(
      `UPDATE progression
       SET temps_passe_secondes = temps_passe_secondes + ?, defi_complete = ?, score_defi = ?
       WHERE eleve_id = ? AND page_id = ?`,
      [temps_passe_secondes || 0, !!defi_complete, score_defi || null, req.user.id, req.params.pageId]
    );
    res.json({ message: 'Progression mise à jour' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

// Enseignant consulte le tableau de bord de progression de sa classe
router.get('/modules/:moduleId/progression', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT el.id AS eleve_id, el.nom, el.prenom, pc.titre AS page,
              p.premiere_vue_at, p.temps_passe_secondes, p.defi_complete, p.score_defi
       FROM pages_cours pc
       JOIN modules_cours mc ON mc.id = pc.module_id
       CROSS JOIN eleve_classe ec
       JOIN eleves el ON el.id = ec.eleve_id
       LEFT JOIN progression p ON p.page_id = pc.id AND p.eleve_id = el.id
       WHERE mc.id = ? AND ec.classe_id = mc.classe_id`,
      [req.params.moduleId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
