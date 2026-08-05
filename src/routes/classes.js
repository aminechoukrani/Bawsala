const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

async function verifierProprietaireClasse(classeId, enseignantId) {
  const [rows] = await pool.query('SELECT id FROM classes WHERE id = ? AND enseignant_id = ?', [classeId, enseignantId]);
  return rows.length > 0;
}

router.post('/', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { etablissement_id, nom, niveau, annee_scolaire, enseignant_id } = req.body;
  if (!etablissement_id || !nom || !niveau || !annee_scolaire) {
    return res.status(400).json({ erreur: 'etablissement_id, nom, niveau et annee_scolaire requis' });
  }

  try {
    let enseignantCible = req.user.id;

    if (req.user.role === 'super_admin') {
      if (!enseignant_id) return res.status(400).json({ erreur: 'enseignant_id requis pour le Super Admin' });
      enseignantCible = enseignant_id;
    } else {
      const [rattachement] = await pool.query(
        `SELECT statut FROM enseignant_etablissement WHERE enseignant_id = ? AND etablissement_id = ?`,
        [req.user.id, etablissement_id]
      );
      if (rattachement.length === 0 || rattachement[0].statut !== 'confirme') {
        return res.status(403).json({ erreur: "Rattachement à cet établissement non confirmé" });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO classes (etablissement_id, enseignant_id, nom, niveau, annee_scolaire) VALUES (?, ?, ?, ?, ?)',
      [etablissement_id, enseignantCible, nom, niveau, annee_scolaire]
    );
    res.status(201).json({ id: result.insertId, nom, niveau, annee_scolaire });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/mes-classes', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM classes WHERE enseignant_id = ? ORDER BY annee_scolaire DESC', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/mes-classes-eleve', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.* FROM classes c
       JOIN eleve_classe ec ON ec.classe_id = c.id
       WHERE ec.eleve_id = ? ORDER BY c.annee_scolaire DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/', verifierToken, autoriserRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const filtre = req.user.role === 'admin' ? 'WHERE et.id = ?' : '';
    const parametres = req.user.role === 'admin' ? [req.user.etablissement_id] : [];
    const [rows] = await pool.query(
      `SELECT c.*, e.nom AS enseignant_nom, et.nom AS etablissement_nom
       FROM classes c
       JOIN enseignants e ON e.id = c.enseignant_id
       JOIN etablissements et ON et.id = c.etablissement_id
       ${filtre}
       ORDER BY et.nom, c.annee_scolaire DESC`,
      parametres
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/:classeId/eleves', verifierToken, autoriserRoles('enseignant', 'admin', 'super_admin'), async (req, res) => {
  try {
    if (req.user.role === 'enseignant') {
      const estProprietaire = await verifierProprietaireClasse(req.params.classeId, req.user.id);
      if (!estProprietaire) return res.status(403).json({ erreur: "Cette classe ne t'appartient pas" });
    } else if (req.user.role === 'admin') {
      const [verif] = await pool.query('SELECT 1 FROM classes WHERE id = ? AND etablissement_id = ?', [req.params.classeId, req.user.etablissement_id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Cette classe n'appartient pas à ton établissement" });
    }
    const [rows] = await pool.query(
      `SELECT el.id, el.massar_code, el.nom, el.prenom, el.date_naissance, ec.remarque
       FROM eleves el
       JOIN eleve_classe ec ON ec.eleve_id = el.id
       WHERE ec.classe_id = ? ORDER BY el.nom`,
      [req.params.classeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:classeId/eleves/:eleveId', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { nom, prenom, date_naissance, remarque } = req.body;
  try {
    if (req.user.role === 'enseignant') {
      const estProprietaire = await verifierProprietaireClasse(req.params.classeId, req.user.id);
      if (!estProprietaire) return res.status(403).json({ erreur: "Cette classe ne t'appartient pas" });
    }

    const champsEleve = [];
    const valeursEleve = [];
    if (nom !== undefined) { champsEleve.push('nom = ?'); valeursEleve.push(nom); }
    if (prenom !== undefined) { champsEleve.push('prenom = ?'); valeursEleve.push(prenom); }
    if (date_naissance !== undefined) { champsEleve.push('date_naissance = ?'); valeursEleve.push(date_naissance); }
    if (champsEleve.length > 0) {
      valeursEleve.push(req.params.eleveId);
      await pool.query(`UPDATE eleves SET ${champsEleve.join(', ')} WHERE id = ?`, valeursEleve);
    }

    if (remarque !== undefined) {
      await pool.query(
        'UPDATE eleve_classe SET remarque = ? WHERE classe_id = ? AND eleve_id = ?',
        [remarque, req.params.classeId, req.params.eleveId]
      );
    }

    res.json({ message: 'Élève mis à jour' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.delete('/:classeId/eleves/:eleveId', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    if (req.user.role === 'enseignant') {
      const estProprietaire = await verifierProprietaireClasse(req.params.classeId, req.user.id);
      if (!estProprietaire) return res.status(403).json({ erreur: "Cette classe ne t'appartient pas" });
    }
    await pool.query('DELETE FROM eleve_classe WHERE classe_id = ? AND eleve_id = ?', [req.params.classeId, req.params.eleveId]);
    res.json({ message: 'Élève retiré de la classe' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/:classeId/presence', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    if (req.user.role === 'enseignant') {
      const estProprietaire = await verifierProprietaireClasse(req.params.classeId, req.user.id);
      if (!estProprietaire) return res.status(403).json({ erreur: "Cette classe ne t'appartient pas" });
    }
    const [rows] = await pool.query(
      `SELECT el.id, el.nom, el.prenom, pe.derniere_activite_at, pc.titre AS page_titre,
              (pe.derniere_activite_at IS NOT NULL AND TIMESTAMPDIFF(SECOND, pe.derniere_activite_at, NOW()) <= 45) AS en_ligne
       FROM eleve_classe ec
       JOIN eleves el ON el.id = ec.eleve_id
       LEFT JOIN presence_eleve pe ON pe.eleve_id = el.id AND pe.classe_id = ec.classe_id
       LEFT JOIN pages_cours pc ON pc.id = pe.page_id
       WHERE ec.classe_id = ?
       ORDER BY en_ligne DESC, el.nom`,
      [req.params.classeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;