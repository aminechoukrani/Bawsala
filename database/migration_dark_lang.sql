CREATE TABLE IF NOT EXISTS traductions_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT NOT NULL,
  langue ENUM('en', 'ar') NOT NULL,
  contenu_traduit MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_traduction (page_id, langue),
  FOREIGN KEY (page_id) REFERENCES pages_cours(id) ON DELETE CASCADE
);
