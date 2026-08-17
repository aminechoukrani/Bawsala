(function() {
  const lienIcones = document.createElement('link');
  lienIcones.rel = 'stylesheet';
  lienIcones.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css';
  document.head.appendChild(lienIcones);
})();

function appliquerTheme() {
  let theme = localStorage.getItem('bawsala_theme');
  if (!theme) {
    const preferesSombre = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = preferesSombre ? 'sombre' : 'clair';
  }
  document.documentElement.setAttribute('data-theme', theme);
}
appliquerTheme();

function basculerTheme() {
  const actuel = localStorage.getItem('bawsala_theme') || 'clair';
  const nouveau = actuel === 'sombre' ? 'clair' : 'sombre';
  localStorage.setItem('bawsala_theme', nouveau);
  appliquerTheme();
  const bouton = document.getElementById('btn-theme-coquille');
  if (bouton) bouton.innerHTML = nouveau === 'sombre' ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
}

const TRADUCTIONS = {
  fr: {
    mes_cours: 'Mes cours', continuer: 'Continuer', commencer: 'Commencer',
    pages_completees: 'pages complétées', deconnexion: 'Déconnexion',
    aucune_classe: "Tu n'es inscrit dans aucune classe pour le moment.",
    aucun_module: 'Aucun module publié pour le moment.',
    precedent: 'Précédent', suivant: 'Suivant', termine: "J'ai terminé cette page",
    progression_enregistree: 'Progression enregistrée ! On passe à la suite...',
    aucune_page: 'Aucune page disponible',
    traduction_en_cours: 'Traduction en cours, merci de patienter...',
    mes_evaluations: 'Mes évaluations', aucune_evaluation: 'Aucune évaluation pour le moment.',
    col_titre: 'Titre', col_classe: 'Classe', col_debut: 'Début', col_duree: 'Durée', col_statut: 'Statut',
    statut_a_venir: 'À venir', statut_en_cours: 'En cours', statut_termine: 'Terminé',
    passer_examen: "Passer l'examen", note_label: 'Note', en_attente_correction: 'En attente de correction',
    non_soumis: 'Non soumis'
  },
  en: {
    mes_cours: 'My courses', continuer: 'Continue', commencer: 'Start',
    pages_completees: 'pages completed', deconnexion: 'Log out',
    aucune_classe: "You're not enrolled in any class yet.",
    aucun_module: 'No published module yet.',
    precedent: 'Previous', suivant: 'Next', termine: 'I finished this page',
    progression_enregistree: 'Progress saved! Moving to the next part...',
    aucune_page: 'No page available',
    traduction_en_cours: 'Translating, please wait...',
    mes_evaluations: 'My evaluations', aucune_evaluation: 'No evaluation yet.',
    col_titre: 'Title', col_classe: 'Class', col_debut: 'Start', col_duree: 'Duration', col_statut: 'Status',
    statut_a_venir: 'Upcoming', statut_en_cours: 'Ongoing', statut_termine: 'Finished',
    passer_examen: 'Take the exam', note_label: 'Grade', en_attente_correction: 'Awaiting grading',
    non_soumis: 'Not submitted'
  },
  ar: {
    mes_cours: 'دروسي', continuer: 'متابعة', commencer: 'ابدأ',
    pages_completees: 'صفحات مكتملة', deconnexion: 'تسجيل الخروج',
    aucune_classe: 'أنت غير مسجل في أي فصل بعد.',
    aucun_module: 'لا توجد وحدة منشورة بعد.',
    precedent: 'السابق', suivant: 'التالي', termine: 'أنهيت هذه الصفحة',
    progression_enregistree: 'تم حفظ التقدم! ننتقل إلى الجزء التالي...',
    aucune_page: 'لا توجد صفحة متاحة',
    traduction_en_cours: 'جارٍ الترجمة، يرجى الانتظار...',
    mes_evaluations: 'تقييماتي', aucune_evaluation: 'لا يوجد تقييم بعد.',
    col_titre: 'العنوان', col_classe: 'الفصل', col_debut: 'البداية', col_duree: 'المدة', col_statut: 'الحالة',
    statut_a_venir: 'قادم', statut_en_cours: 'جارٍ', statut_termine: 'منتهٍ',
    passer_examen: 'إجراء الامتحان', note_label: 'العلامة', en_attente_correction: 'في انتظار التصحيح',
    non_soumis: 'لم يتم التسليم'
  }
};

function recupererLangue() {
  return localStorage.getItem('bawsala_langue') || 'fr';
}

function definirLangue(langue) {
  localStorage.setItem('bawsala_langue', langue);
  document.documentElement.lang = langue;
  document.documentElement.dir = langue === 'ar' ? 'rtl' : 'ltr';
}
definirLangue(recupererLangue());

function t(cle) {
  return (TRADUCTIONS[recupererLangue()] || TRADUCTIONS.fr)[cle] || cle;
}

function sauvegarderSession(token, utilisateur) {
  sessionStorage.setItem('bawsala_token', token);
  sessionStorage.setItem('bawsala_utilisateur', JSON.stringify(utilisateur));
}

function recupererToken() {
  return sessionStorage.getItem('bawsala_token');
}

function recupererUtilisateur() {
  const brut = sessionStorage.getItem('bawsala_utilisateur');
  return brut ? JSON.parse(brut) : null;
}

function deconnecter() {
  sessionStorage.removeItem('bawsala_token');
  sessionStorage.removeItem('bawsala_utilisateur');
  window.location.href = '/';
}

function exigerConnexion(roleAttendu) {
  const utilisateur = recupererUtilisateur();
  if (!recupererToken() || !utilisateur || (roleAttendu && utilisateur.role !== roleAttendu)) {
    window.location.href = '/';
    return null;
  }
  return utilisateur;
}

async function appelApi(chemin, options = {}) {
  const token = recupererToken();
  const entetes = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) entetes['Authorization'] = `Bearer ${token}`;

  const reponse = await fetch(`/api${chemin}`, { ...options, headers: entetes });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(donnees.erreur || `Erreur ${reponse.status}`);
    erreur.status = reponse.status;
    throw erreur;
  }
  return donnees;
}

async function telechargerPdf(chemin) {
  const token = recupererToken();
  const reponse = await fetch(`/api${chemin}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!reponse.ok) {
    const donnees = await reponse.json().catch(() => ({}));
    throw new Error(donnees.erreur || 'Erreur lors du téléchargement');
  }
  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function executerScripts(conteneur) {
  const anciensScripts = conteneur.querySelectorAll('script');
  anciensScripts.forEach(ancien => {
    const nouveau = document.createElement('script');
    Array.from(ancien.attributes).forEach(attr => nouveau.setAttribute(attr.name, attr.value));
    nouveau.textContent = ancien.textContent;
    ancien.parentNode.replaceChild(nouveau, ancien);
  });
}

function svgBoussole(taille, enChargement) {
  const classe = enChargement ? 'boussole-icone boussole-chargement' : 'boussole-icone';
  const idDegrade = 'degradeBoussole' + Math.round(Math.random() * 100000);
  return `<svg class="${classe}" width="${taille}" height="${taille}" viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="${idDegrade}" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0%" stop-color="#14B8A6"/>
        <stop offset="100%" stop-color="#7C3AED"/>
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#${idDegrade})"/>
    <path d="M16 7 L19.5 16 L16 25 L12.5 16 Z" fill="#FFFFFF"/>
    <circle cx="16" cy="16" r="2.2" fill="#FF6B4A"/>
  </svg>`;
}

const NAV_PAR_ROLE = {
  super_admin: [{ href: '/tableau-super-admin.html', label: 'Établissements', icone: 'ti-building-bank' }],
  admin: [{ href: '/tableau-admin.html', label: 'Rattachements', icone: 'ti-users-group' }],
  enseignant: [
    { href: '/tableau-enseignant.html', label: 'Mes classes', icone: 'ti-school' },
    { href: '/tableau-evaluations.html', label: 'Évaluations', icone: 'ti-clipboard-list' }
  ],
  eleve: [{ href: '/tableau-eleve.html', label: 'Mes cours', icone: 'ti-books' }]
};

function injecterCoquille({ role, pageActuelle, titre }) {
  const utilisateur = recupererUtilisateur();
  const liens = NAV_PAR_ROLE[role] || [];
  const navHtml = liens.map(l =>
    `<a href="${l.href}" class="${pageActuelle === l.href ? 'actif' : ''}"><i class="ti ${l.icone}"></i>${l.label}</a>`
  ).join('');

  const contenuExistant = document.getElementById('contenu-original');
  const contenuHtml = contenuExistant ? contenuExistant.innerHTML : '';

  document.body.innerHTML = `
    <div class="coquille-app">
      <aside class="barre-laterale">
        <div class="marque">${svgBoussole(28)} Bawsala</div>
        <nav>${navHtml}</nav>
        <div class="pied">
          <button id="btn-deconnexion-coquille" class="bouton-discret" style="width:100%;"><i class="ti ti-logout"></i>Déconnexion</button>
        </div>
      </aside>
      <div class="zone-principale">
        <header class="entete-app">
          <h1>${titre}</h1>
          <div style="display:flex; align-items:center; gap:14px;">
            ${role === 'eleve' ? `
              <select id="select-langue-coquille" class="champ-bawsala" style="width:auto; padding:6px 10px;">
                <option value="fr" ${recupererLangue() === 'fr' ? 'selected' : ''}>Français</option>
                <option value="en" ${recupererLangue() === 'en' ? 'selected' : ''}>English</option>
                <option value="ar" ${recupererLangue() === 'ar' ? 'selected' : ''}>العربية</option>
              </select>
            ` : ''}
            <button id="btn-theme-coquille" class="bouton-discret" style="padding:8px 10px;">
              <i class="ti ${localStorage.getItem('bawsala_theme') === 'sombre' ? 'ti-sun' : 'ti-moon'}"></i>
            </button>
            <span style="color:var(--texte-doux);font-size:0.85rem;font-weight:700;">${utilisateur ? (utilisateur.nom || utilisateur.prenom || '') : ''}</span>
          </div>
        </header>
        <div class="contenu-app">${contenuHtml}</div>
      </div>
    </div>
  `;
  document.getElementById('btn-deconnexion-coquille').addEventListener('click', deconnecter);
  document.getElementById('btn-theme-coquille').addEventListener('click', basculerTheme);
  const selectLangue = document.getElementById('select-langue-coquille');
  if (selectLangue) {
    selectLangue.addEventListener('change', () => {
      definirLangue(selectLangue.value);
      window.location.reload();
    });
  }
}