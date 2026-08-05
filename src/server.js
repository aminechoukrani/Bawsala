const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const rattachementsRoutes = require('./routes/rattachements');
const coursRoutes = require('./routes/cours');
const evaluationsRoutes = require('./routes/evaluations');
const etablissementsRoutes = require('./routes/etablissements');
const comptesRoutes = require('./routes/comptes');
const classesRoutes = require('./routes/classes');
const modificationsRoutes = require('./routes/modifications');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/rattachements', rattachementsRoutes);
app.use('/api/cours', coursRoutes);
app.use('/api/evaluations', evaluationsRoutes);
app.use('/api/etablissements', etablissementsRoutes);
app.use('/api/comptes', comptesRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/modifications', modificationsRoutes);

app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
