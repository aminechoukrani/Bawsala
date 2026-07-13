const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const rattachementsRoutes = require('./routes/rattachements');
const coursRoutes = require('./routes/cours');
const evaluationsRoutes = require('./routes/evaluations');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rattachements', rattachementsRoutes);
app.use('/api/cours', coursRoutes);
app.use('/api/evaluations', evaluationsRoutes);

app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
