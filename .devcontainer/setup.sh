#!/bin/bash
set -e

echo "Installation de MariaDB..."
sudo apt-get update
sudo apt-get install -y mariadb-server

echo "Démarrage de MariaDB..."
sudo service mariadb start

echo "Création de la base de données et chargement du schéma..."
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS gestiplateforme;"
sudo mariadb -e "CREATE USER IF NOT EXISTS 'dev'@'localhost' IDENTIFIED BY 'devpassword';"
sudo mariadb -e "GRANT ALL PRIVILEGES ON gestiplateforme.* TO 'dev'@'localhost';"
sudo mariadb -e "FLUSH PRIVILEGES;"
sudo mariadb gestiplateforme < database/schema.sql

echo "Installation des dépendances Node..."
npm install

echo "Copie du fichier .env.example vers .env (à ajuster si besoin)..."
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "Setup terminé. Lance 'npm run dev' pour démarrer le serveur."
