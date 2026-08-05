ALTER TABLE enseignant_etablissement
  ADD COLUMN initiee_par ENUM('enseignant', 'admin') DEFAULT 'enseignant',
  ADD COLUMN accepte_par_enseignant BOOLEAN DEFAULT FALSE,
  ADD COLUMN confirme_par_superadmin BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS modifications_proposees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type_cible ENUM('enseignant_info', 'classe_info') NOT NULL,
  cible_id INT NOT NULL,
  admin_id INT NOT NULL,
  donnees_proposees JSON NOT NULL,
  accepte_par_enseignant BOOLEAN DEFAULT FALSE,
  confirme_par_superadmin BOOLEAN DEFAULT FALSE,
  statut ENUM('en_attente', 'applique', 'refuse') DEFAULT 'en_attente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
