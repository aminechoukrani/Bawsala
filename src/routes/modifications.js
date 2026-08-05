const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

async function appliquerSiPret(id) {
  const [rows] = await pool.query('SELECT * FROM modifications_proposees WHERE id = ?', [id]);
  if (rows.length === 0) return;
  const proposition = rows[0];
  if (!proposition.accepte_par_enseignant || !proposition.confirme_par_superadmin) return;

  const donnees = JSON.parse(proposition.donnees_proposees);

  if (proposition.type_cible === 'enseignant_info') {
    const champs = [];
    const valeurs = [];
    if (donnees.nom) { champs.push('nom = ?'); valeurs.push(donnees.nom); }
    if (donnees.email) { champs.push('email = ?'); valeurs.push(donnees.email); }
    if (champs.length > 0) {
      valeurs.push(proposition.cible_id);
      await pool.query(`UPDATE enseignants SET ${champs.join(', ')} WHERE id = ?`, valeurs);
    }
  } else if (proposition.type_cible === 'classe_info') {
    const champs = [];
    const valeurs = [];
    if (donnees.nom) { champs.push('nom = ?'); valeurs.push(donnees.nom); }
    if (donnees.niveau) { champs.push('niveau = ?'); valeurs.push(donnees.niveau); }
    if (donnees.annee_scolaire) { champs.push('annee_scolaire = ?'); valeurs.push(donnees.annee_scolaire); }
    if (champs.length > 0) {
      valeurs.push(proposition.cible_id);
      await pool.query(`UPDATE classes SET ${champs.join(', ')} WHERE id = ?`, valeurs);
    }
  }

  await pool.query("UPDATE modifications_proposees SET statut = 'applique' WHERE id = ?", [id]);
}

router.post('/', verifierToken, autoriserRoles('admin'), async (req, res) => {
  const { type_cible, cible_id, donnees } = req.body;
  if (!['enseignant_info', 'classe_info'].includes(type_cible) || !cible_id || !donnees) {
    return res.status(400).json({ erreur: 'type_cible, cible_id et donnees requis' });
  }
  try {
    if (type_cible === 'enseignant_info') {
      const [verif] = await pool.query(
        `SELECT 1 FROM enseignant_etablissement WHERE enseignant_id = ? AND etablissement_id = ? AND statut = 'confirme'`,
        [cible_id, req.user.etablissement_id]
      );
      if (verif.length === 0) return res.status(403).json({ erreur: "Cet enseignant n'est pas confirmé dans ton établissement" });
    } else {
      const [verif] = await pool.query('SELECT 1 FROM classes WHERE id = ? AND etablissement_id = ?', [cible_id, req.user.etablissement_id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Cette classe n'appartient pas à ton établissement" });
    }

    const [result] = await pool.query(
      `INSERT INTO modifications_proposees (type_cible, cible_id, admin_id, donnees_proposees)
       VALUES (?, ?, ?, ?)`,
      [type_cible, cible_id, req.user.id, JSON.stringify(donnees)]
    );
    res.status(201).json({ id: result.insertId, message: "Proposition envoyée, en attente d'acceptation et de confirmation" });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/mes-propositions', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [propositionsDirectes] = await pool.query(
      `SELECT * FROM modifications_proposees
       WHERE type_cible = 'enseignant_info' AND cible_id = ? AND statut = 'en_attente' AND accepte_par_enseignant = FALSE`,
      [req.user.id]
    );
    const [propositionsClasses] = await pool.query(
      `SELECT mp.* FROM modifications_proposees mp
       JOIN classes c ON c.id = mp.cible_id
       WHERE mp.type_cible = 'classe_info' AND c.enseignant_id = ?
         AND mp.statut = 'en_attente' AND mp.accepte_par_enseignant = FALSE`,
      [req.user.id]
    );
    res.json([...propositionsDirectes, ...propositionsClasses]);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/accepter', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    await pool.query('UPDATE modifications_proposees SET accepte_par_enseignant = TRUE WHERE id = ?', [req.params.id]);
    await appliquerSiPret(req.params.id);
    res.json({ message: 'Proposition acceptée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/attente-superadmin', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM modifications_proposees WHERE statut = 'en_attente' AND confirme_par_superadmin = FALSE`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/confirmer-superadmin', verifierToken, autoriserRoles('super_admin'), async (req, res) => {
  try {
    await pool.query('UPDATE modifications_proposees SET confirme_par_superadmin = TRUE WHERE id = ?', [req.params.id]);
    await appliquerSiPret(req.params.id);
    res.json({ message: 'Confirmé par le Super Admin.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
