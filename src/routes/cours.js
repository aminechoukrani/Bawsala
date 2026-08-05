const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

router.get('/classes/:classeId/modules', verifierToken, autoriserRoles('enseignant', 'eleve'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM modules_cours WHERE classe_id = ? ORDER BY ordre',
      [req.params.classeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/modules/:moduleId/pages', verifierToken, autoriserRoles('enseignant', 'eleve'), async (req, res) => {
  try {
    const filtreValidation = req.user.role === 'eleve' ? 'AND valide_par_enseignant = TRUE' : '';
    const [rows] = await pool.query(
      `SELECT id, titre, ordre, valide_par_enseignant FROM pages_cours
       WHERE module_id = ? ${filtreValidation} ORDER BY ordre`,
      [req.params.moduleId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/modules', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { classe_id, titre, matiere, enseignant_id } = req.body;
  try {
    let enseignantCible = req.user.id;
    if (req.user.role === 'super_admin') {
      if (!enseignant_id) return res.status(400).json({ erreur: 'enseignant_id requis pour le Super Admin' });
      enseignantCible = enseignant_id;
    }
    const [maxOrdre] = await pool.query('SELECT COALESCE(MAX(ordre), -1) AS max_ordre FROM modules_cours WHERE classe_id = ?', [classe_id]);
    const prochainOrdre = maxOrdre[0].max_ordre + 1;
    const [result] = await pool.query(
      'INSERT INTO modules_cours (classe_id, enseignant_id, titre, matiere, ordre) VALUES (?, ?, ?, ?, ?)',
      [classe_id, enseignantCible, titre, matiere || 'Informatique', prochainOrdre]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/modules/:moduleId/pages', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { titre, contenu_html, a_bloc_code_executable, genere_par_ia } = req.body;
  try {
    const [maxOrdre] = await pool.query('SELECT COALESCE(MAX(ordre), -1) AS max_ordre FROM pages_cours WHERE module_id = ?', [req.params.moduleId]);
    const prochainOrdre = maxOrdre[0].max_ordre + 1;
    const [result] = await pool.query(
      `INSERT INTO pages_cours
       (module_id, titre, contenu_html, a_bloc_code_executable, ordre, genere_par_ia, valide_par_enseignant)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.moduleId, titre, contenu_html,
        !!a_bloc_code_executable, prochainOrdre,
        !!genere_par_ia, genere_par_ia ? false : true
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/pages/:pageId/valider', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    await pool.query('UPDATE pages_cours SET valide_par_enseignant = TRUE WHERE id = ?', [req.params.pageId]);
    res.json({ message: 'Page validée et publiée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/pages/:pageId', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  try {
    const [pages] = await pool.query(
      'SELECT * FROM pages_cours WHERE id = ? AND valide_par_enseignant = TRUE',
      [req.params.pageId]
    );
    if (pages.length === 0) return res.status(404).json({ erreur: 'Page introuvable ou non publiée' });

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

router.get('/classes/:classeId/progression', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT el.id AS eleve_id, el.nom, el.prenom,
              COUNT(DISTINCT pc.id) AS total_pages,
              COUNT(DISTINCT CASE WHEN p.defi_complete = TRUE THEN pc.id END) AS pages_completees,
              MAX(p.derniere_vue_at) AS derniere_activite
       FROM eleve_classe ec
       JOIN eleves el ON el.id = ec.eleve_id
       JOIN modules_cours mc ON mc.classe_id = ec.classe_id
       JOIN pages_cours pc ON pc.module_id = mc.id AND pc.valide_par_enseignant = TRUE
       LEFT JOIN progression p ON p.page_id = pc.id AND p.eleve_id = el.id
       WHERE ec.classe_id = ?
       GROUP BY el.id, el.nom, el.prenom
       ORDER BY el.nom`,
      [req.params.classeId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/modules/:moduleId/attestation/:eleveId', verifierToken, autoriserRoles('enseignant', 'super_admin', 'eleve'), async (req, res) => {
  const { moduleId, eleveId } = req.params;

  if (req.user.role === 'eleve' && String(req.user.id) !== String(eleveId)) {
    return res.status(403).json({ erreur: "Tu ne peux consulter que ta propre attestation" });
  }

  try {
    const [modules] = await pool.query(
      `SELECT mc.titre AS module_titre, c.nom AS classe_nom, et.nom AS etablissement_nom, mc.enseignant_id
       FROM modules_cours mc
       JOIN classes c ON c.id = mc.classe_id
       JOIN etablissements et ON et.id = c.etablissement_id
       WHERE mc.id = ?`,
      [moduleId]
    );
    if (modules.length === 0) return res.status(404).json({ erreur: 'Module introuvable' });
    const infosModule = modules[0];

    if (req.user.role === 'enseignant' && req.user.id !== infosModule.enseignant_id) {
      return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });
    }

    const [eleves] = await pool.query('SELECT nom, prenom, massar_code FROM eleves WHERE id = ?', [eleveId]);
    if (eleves.length === 0) return res.status(404).json({ erreur: 'Élève introuvable' });
    const eleve = eleves[0];

    const [pages] = await pool.query(
      `SELECT pc.titre, p.premiere_vue_at, p.temps_passe_secondes, p.defi_complete
       FROM pages_cours pc
       LEFT JOIN progression p ON p.page_id = pc.id AND p.eleve_id = ?
       WHERE pc.module_id = ? AND pc.valide_par_enseignant = TRUE
       ORDER BY pc.ordre`,
      [eleveId, moduleId]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="attestation-${eleve.massar_code}-module${moduleId}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('Bawsala — Attestation de parcours', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11)
      .text(`Établissement : ${infosModule.etablissement_nom}`)
      .text(`Classe : ${infosModule.classe_nom}`)
      .text(`Module : ${infosModule.module_titre}`)
      .text(`Élève : ${eleve.nom} ${eleve.prenom} (Massar : ${eleve.massar_code})`)
      .text(`Document généré le : ${new Date().toLocaleString('fr-FR')}`);
    doc.moveDown();

    doc.fontSize(13).text('Détail du parcours', { underline: true });
    doc.moveDown(0.5);

    pages.forEach(page => {
      doc.fontSize(10);
      doc.text(`• ${page.titre}`, { continued: false });
      if (page.premiere_vue_at) {
        doc.text(`   Consulté le : ${new Date(page.premiere_vue_at).toLocaleString('fr-FR')}`);
        doc.text(`   Temps passé : ${page.temps_passe_secondes || 0} secondes`);
        doc.text(`   Défi complété : ${page.defi_complete ? 'Oui' : 'Non'}`);
      } else {
        doc.text('   Non consulté à ce jour');
      }
      doc.moveDown(0.3);
    });

    doc.moveDown();
    doc.fontSize(8).fillColor('#5B6B72')
      .text('Ce document est généré automatiquement par Bawsala à partir des journaux d\'activité horodatés de la plateforme.', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/presence', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  const { classe_id, page_id } = req.body;
  if (!classe_id) return res.status(400).json({ erreur: 'classe_id requis' });
  try {
    await pool.query(
      `INSERT INTO presence_eleve (eleve_id, classe_id, page_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE classe_id = ?, page_id = ?, derniere_activite_at = CURRENT_TIMESTAMP`,
      [req.user.id, classe_id, page_id || null, classe_id, page_id || null]
    );
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.delete('/modules/:moduleId', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    if (req.user.role === 'enseignant') {
      const [verif] = await pool.query('SELECT id FROM modules_cours WHERE id = ? AND enseignant_id = ?', [req.params.moduleId, req.user.id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });
    }
    await pool.query('DELETE FROM modules_cours WHERE id = ?', [req.params.moduleId]);
    res.json({ message: 'Module supprimé' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/modules/:moduleId/deplacer', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { direction } = req.body;
  if (!['haut', 'bas'].includes(direction)) return res.status(400).json({ erreur: 'direction invalide' });

  try {
    const [modules] = await pool.query('SELECT id, classe_id, ordre FROM modules_cours WHERE id = ?', [req.params.moduleId]);
    if (modules.length === 0) return res.status(404).json({ erreur: 'Module introuvable' });
    const module = modules[0];

    if (req.user.role === 'enseignant') {
      const [verif] = await pool.query('SELECT id FROM modules_cours WHERE id = ? AND enseignant_id = ?', [req.params.moduleId, req.user.id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });
    }

    const operateur = direction === 'haut' ? '<' : '>';
    const tri = direction === 'haut' ? 'DESC' : 'ASC';
    const [voisins] = await pool.query(
      `SELECT id, ordre FROM modules_cours WHERE classe_id = ? AND ordre ${operateur} ? ORDER BY ordre ${tri} LIMIT 1`,
      [module.classe_id, module.ordre]
    );
    if (voisins.length === 0) return res.json({ message: 'Déjà à cette extrémité' });

    const voisin = voisins[0];
    await pool.query('UPDATE modules_cours SET ordre = ? WHERE id = ?', [voisin.ordre, module.id]);
    await pool.query('UPDATE modules_cours SET ordre = ? WHERE id = ?', [module.ordre, voisin.id]);
    res.json({ message: 'Module déplacé' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.patch('/modules/:moduleId/pages/:pageId/deplacer', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { direction } = req.body;
  if (!['haut', 'bas'].includes(direction)) return res.status(400).json({ erreur: 'direction invalide' });

  try {
    if (req.user.role === 'enseignant') {
      const [verif] = await pool.query('SELECT id FROM modules_cours WHERE id = ? AND enseignant_id = ?', [req.params.moduleId, req.user.id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });
    }

    const [pages] = await pool.query('SELECT id, ordre FROM pages_cours WHERE id = ? AND module_id = ?', [req.params.pageId, req.params.moduleId]);
    if (pages.length === 0) return res.status(404).json({ erreur: 'Page introuvable' });
    const page = pages[0];

    const operateur = direction === 'haut' ? '<' : '>';
    const tri = direction === 'haut' ? 'DESC' : 'ASC';
    const [voisins] = await pool.query(
      `SELECT id, ordre FROM pages_cours WHERE module_id = ? AND ordre ${operateur} ? ORDER BY ordre ${tri} LIMIT 1`,
      [req.params.moduleId, page.ordre]
    );
    if (voisins.length === 0) return res.json({ message: 'Déjà à cette extrémité' });

    const voisin = voisins[0];
    await pool.query('UPDATE pages_cours SET ordre = ? WHERE id = ?', [voisin.ordre, page.id]);
    await pool.query('UPDATE pages_cours SET ordre = ? WHERE id = ?', [page.ordre, voisin.id]);
    res.json({ message: 'Page déplacée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.delete('/modules/:moduleId/pages/:pageId', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    if (req.user.role === 'enseignant') {
      const [verif] = await pool.query('SELECT id FROM modules_cours WHERE id = ? AND enseignant_id = ?', [req.params.moduleId, req.user.id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });
    }
    await pool.query('DELETE FROM pages_cours WHERE id = ? AND module_id = ?', [req.params.pageId, req.params.moduleId]);
    res.json({ message: 'Page supprimée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/modules/:moduleId/generer-page', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  const { sujet } = req.body;
  if (!sujet) return res.status(400).json({ erreur: 'sujet requis' });

  try {
    if (req.user.role === 'enseignant') {
      const [verif] = await pool.query('SELECT id FROM modules_cours WHERE id = ? AND enseignant_id = ?', [req.params.moduleId, req.user.id]);
      if (verif.length === 0) return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });
    }

    const reponseIA = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `Découpe un cours d'informatique en étapes courtes façon Sololearn (une petite notion à la fois,
navigation Suivant/Précédent), sur le sujet : "${sujet}".
Public : élèves marocains de lycée (collégial ou tronc commun), en français.

Réponds STRICTEMENT avec un objet JSON de cette forme, sans texte autour, sans balises markdown :
{
  "etapes": [
    { "titre": "Titre court de l'étape", "contenu_html": "<p>...</p>" },
    { "titre": "...", "contenu_html": "..." }
  ]
}

Règles pour contenu_html de chaque étape :
- 4 à 7 étapes au total. Chaque étape = une seule petite idée, pas un cours entier d'un coup.
- HTML uniquement (h4, p, ul/li, pre/code) — pas de <html>/<head>/<body>/<style>/<script>.
- Utilise ces classes CSS déjà stylées si utile : .badge-statut.badge-confirme, .alerte-bawsala.alerte-succes, .donnee-mono.
- Au moins une étape avec un mini défi utilisant <details><summary>Voir la solution</summary>...</details>
  pour que l'élève réfléchisse avant de voir la réponse.
- La dernière étape doit être un récapitulatif ou un défi de synthèse.`
        }]
      })
    });

    if (!reponseIA.ok) {
      const erreurTexte = await reponseIA.text();
      return res.status(502).json({ erreur: "Erreur de l'API Mistral", details: erreurTexte });
    }

    const donneesIA = await reponseIA.json();
    const contenuBrut = donneesIA.choices[0].message.content;
    const structure = JSON.parse(contenuBrut);

    if (!structure.etapes || !Array.isArray(structure.etapes) || structure.etapes.length === 0) {
      return res.status(502).json({ erreur: "Réponse IA invalide (pas d'étapes)" });
    }

    const [maxOrdre] = await pool.query('SELECT COALESCE(MAX(ordre), -1) AS max_ordre FROM pages_cours WHERE module_id = ?', [req.params.moduleId]);
    const [result] = await pool.query(
      `INSERT INTO pages_cours (module_id, titre, contenu_html, ordre, genere_par_ia, valide_par_enseignant, format_contenu)
       VALUES (?, ?, ?, ?, TRUE, FALSE, 'etapes_json')`,
      [req.params.moduleId, sujet, JSON.stringify(structure.etapes), maxOrdre[0].max_ordre + 1]
    );

    res.status(201).json({ id: result.insertId, titre: sujet, etapes: structure.etapes });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/pages/:pageId/contenu', verifierToken, autoriserRoles('enseignant', 'super_admin'), async (req, res) => {
  try {
    const [pages] = await pool.query(
      `SELECT pc.*, mc.enseignant_id
       FROM pages_cours pc
       JOIN modules_cours mc ON mc.id = pc.module_id
       WHERE pc.id = ?`,
      [req.params.pageId]
    );
    if (pages.length === 0) return res.status(404).json({ erreur: 'Page introuvable' });
    if (req.user.role === 'enseignant' && req.user.id !== pages[0].enseignant_id) {
      return res.status(403).json({ erreur: "Cette page ne t'appartient pas" });
    }
    res.json(pages[0]);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/mes-pages', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pc.id, pc.titre AS page_titre, mc.titre AS module_titre, c.nom AS classe_nom
       FROM pages_cours pc
       JOIN modules_cours mc ON mc.id = pc.module_id
       JOIN classes c ON c.id = mc.classe_id
       WHERE mc.enseignant_id = ?
       ORDER BY c.nom, mc.titre, pc.ordre`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.post('/modules/:moduleId/copier-page', verifierToken, autoriserRoles('enseignant'), async (req, res) => {
  const { page_id_source } = req.body;
  if (!page_id_source) return res.status(400).json({ erreur: 'page_id_source requis' });

  try {
    const [verifCible] = await pool.query('SELECT id FROM modules_cours WHERE id = ? AND enseignant_id = ?', [req.params.moduleId, req.user.id]);
    if (verifCible.length === 0) return res.status(403).json({ erreur: "Ce module ne t'appartient pas" });

    const [source] = await pool.query(
      `SELECT pc.* FROM pages_cours pc
       JOIN modules_cours mc ON mc.id = pc.module_id
       WHERE pc.id = ? AND mc.enseignant_id = ?`,
      [page_id_source, req.user.id]
    );
    if (source.length === 0) return res.status(404).json({ erreur: "Page source introuvable ou ne t'appartenant pas" });

    const pageSource = source[0];
    const [maxOrdre] = await pool.query('SELECT COALESCE(MAX(ordre), -1) AS max_ordre FROM pages_cours WHERE module_id = ?', [req.params.moduleId]);
    const [result] = await pool.query(
      `INSERT INTO pages_cours
       (module_id, titre, contenu_html, a_bloc_code_executable, ordre, genere_par_ia, valide_par_enseignant, format_contenu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.moduleId, pageSource.titre, pageSource.contenu_html,
        pageSource.a_bloc_code_executable, maxOrdre[0].max_ordre + 1, pageSource.genere_par_ia,
        pageSource.valide_par_enseignant, pageSource.format_contenu
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Page copiée' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/modules/:moduleId/ma-progression', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(DISTINCT pc.id) AS total_pages,
              COUNT(DISTINCT CASE WHEN p.defi_complete = TRUE THEN pc.id END) AS pages_completees
       FROM pages_cours pc
       LEFT JOIN progression p ON p.page_id = pc.id AND p.eleve_id = ?
       WHERE pc.module_id = ? AND pc.valide_par_enseignant = TRUE`,
      [req.user.id, req.params.moduleId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

router.get('/pages/:pageId/traduction/:langue', verifierToken, autoriserRoles('eleve'), async (req, res) => {
  const { pageId, langue } = req.params;
  if (!['en', 'ar'].includes(langue)) return res.status(400).json({ erreur: 'langue invalide' });

  try {
    const [pages] = await pool.query('SELECT * FROM pages_cours WHERE id = ? AND valide_par_enseignant = TRUE', [pageId]);
    if (pages.length === 0) return res.status(404).json({ erreur: 'Page introuvable' });
    const page = pages[0];

    const [cache] = await pool.query('SELECT contenu_traduit FROM traductions_pages WHERE page_id = ? AND langue = ?', [pageId, langue]);
    if (cache.length > 0) {
      return res.json({ ...page, contenu_html: cache[0].contenu_traduit });
    }

    const nomLangue = langue === 'en' ? 'anglais' : 'arabe';
    const estJson = page.format_contenu === 'etapes_json';

    const reponseIA = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: estJson
            ? `Traduis vers l'${nomLangue} UNIQUEMENT les valeurs "titre" et "contenu_html" de ce tableau JSON, en gardant EXACTEMENT la même structure JSON et les mêmes balises HTML. Ne traduis pas le code informatique dans les balises <pre><code>. Réponds uniquement avec le JSON traduit valide, sans texte autour, sans balises markdown :\n\n${page.contenu_html}`
            : `Traduis ce contenu HTML de cours vers l'${nomLangue}, en gardant EXACTEMENT les mêmes balises HTML. Ne traduis pas le code informatique dans les balises <pre><code>. Réponds uniquement avec le HTML traduit, sans texte autour :\n\n${page.contenu_html}`
        }]
      })
    });

    if (!reponseIA.ok) {
      const erreurTexte = await reponseIA.text();
      return res.status(502).json({ erreur: "Erreur de l'API Mistral", details: erreurTexte });
    }

    const donneesIA = await reponseIA.json();
    let contenuTraduit = donneesIA.choices[0].message.content.trim();
    contenuTraduit = contenuTraduit.replace(/^```(json)?/i, '').replace(/```$/, '').trim();

    await pool.query(
      `INSERT INTO traductions_pages (page_id, langue, contenu_traduit) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE contenu_traduit = ?`,
      [pageId, langue, contenuTraduit, contenuTraduit]
    );

    res.json({ ...page, contenu_html: contenuTraduit });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;