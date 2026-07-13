const jwt = require('jsonwebtoken');
require('dotenv').config();

// Vérifie le token et attache l'utilisateur (id, role, etablissement_id) à la requête
function verifierToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erreur: 'Token manquant' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, etablissement_id? }
    next();
  } catch (err) {
    return res.status(401).json({ erreur: 'Token invalide ou expiré' });
  }
}

// Restreint l'accès à une liste de rôles autorisés
// ex: autoriserRoles('super_admin', 'enseignant')
function autoriserRoles(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.user || !rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ erreur: 'Accès refusé pour ce rôle' });
    }
    next();
  };
}

// Règle spécifique module DS/Évaluations : uniquement l'enseignant créateur ou le super_admin.
// À utiliser après avoir chargé l'évaluation concernée (req.evaluation.enseignant_id)
function autoriserAccesEvaluation(req, res, next) {
  const { role, id } = req.user;
  if (role === 'super_admin') return next();
  if (role === 'enseignant' && req.evaluation && req.evaluation.enseignant_id === id) {
    return next();
  }
  return res.status(403).json({
    erreur: "Accès refusé : seul l'enseignant créateur ou le super admin peut accéder à cette évaluation"
  });
}

module.exports = { verifierToken, autoriserRoles, autoriserAccesEvaluation };
