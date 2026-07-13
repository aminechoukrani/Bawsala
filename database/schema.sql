-- ============================================================
-- Schéma gestiplateforme
-- Multi-établissement, rôles: super_admin / admin / enseignant / eleve
-- ============================================================

CREATE TABLE IF NOT EXISTS etablissements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  ville VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS super_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  etablissement_id INT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enseignants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rattachement enseignant <-> établissement, avec confirmation obligatoire
CREATE TABLE IF NOT EXISTS enseignant_etablissement (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enseignant_id INT NOT NULL,
  etablissement_id INT NOT NULL,
  statut ENUM('en_attente', 'confirme', 'refuse') DEFAULT 'en_attente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rattachement (enseignant_id, etablissement_id),
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE,
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  etablissement_id INT NOT NULL,
  enseignant_id INT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  niveau ENUM('college', 'tronc_commun_scientifique', 'tronc_commun_litteraire') NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL, -- ex: '2026-2027'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE CASCADE,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eleves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  massar_code VARCHAR(20) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  date_naissance DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eleve_classe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id INT NOT NULL,
  classe_id INT NOT NULL,
  UNIQUE KEY unique_inscription (eleve_id, classe_id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- ============================================================
-- Module e-learning : cours + progression (preuve horodatée)
-- ============================================================

CREATE TABLE IF NOT EXISTS modules_cours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  classe_id INT NOT NULL,
  enseignant_id INT NOT NULL,
  titre VARCHAR(150) NOT NULL,
  matiere VARCHAR(50) DEFAULT 'Informatique',
  ordre INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages_cours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_id INT NOT NULL,
  titre VARCHAR(150) NOT NULL,
  contenu_html MEDIUMTEXT NOT NULL,
  a_bloc_code_executable BOOLEAN DEFAULT FALSE,
  ordre INT DEFAULT 0,
  genere_par_ia BOOLEAN DEFAULT FALSE,
  valide_par_enseignant BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules_cours(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS progression (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id INT NOT NULL,
  page_id INT NOT NULL,
  premiere_vue_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  derniere_vue_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  temps_passe_secondes INT DEFAULT 0,
  defi_complete BOOLEAN DEFAULT FALSE,
  score_defi DECIMAL(5,2),
  UNIQUE KEY unique_progression (eleve_id, page_id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages_cours(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attestations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id INT NOT NULL,
  module_id INT NOT NULL,
  chemin_pdf VARCHAR(255) NOT NULL,
  genere_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES modules_cours(id) ON DELETE CASCADE
);

-- ============================================================
-- Module DS / Évaluations — accès restreint : enseignant créateur + super_admin uniquement
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  classe_id INT NOT NULL,
  enseignant_id INT NOT NULL,
  titre VARCHAR(150) NOT NULL,
  date_evaluation DATETIME NOT NULL,
  duree_minutes INT NOT NULL,
  statut ENUM('brouillon', 'planifie', 'en_cours', 'termine') DEFAULT 'brouillon',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evaluation_id INT NOT NULL,
  enonce TEXT NOT NULL,
  type ENUM('qcm', 'texte_libre', 'code') DEFAULT 'qcm',
  parametres_variantes JSON, -- valeurs/ordre à varier par élève
  ordre INT DEFAULT 0,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reponses_eleves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evaluation_id INT NOT NULL,
  eleve_id INT NOT NULL,
  question_id INT NOT NULL,
  reponse TEXT,
  horodatage TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  temps_reponse_secondes INT,
  flag_suspect BOOLEAN DEFAULT FALSE,
  raison_flag VARCHAR(255),
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id INT NOT NULL,
  evaluation_id INT NOT NULL,
  note DECIMAL(5,2),
  corrige_par_ia BOOLEAN DEFAULT FALSE,
  valide_par_enseignant BOOLEAN DEFAULT FALSE,
  publie BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_note (eleve_id, evaluation_id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
);
