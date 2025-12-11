const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware de sécurité
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Logging
app.use(morgan('dev'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés (protégé par l'application)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/folders', require('./routes/folderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/workflows', require('./routes/workflowRoutes'));
app.use('/api/shares', require('./routes/shareRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error('Erreur:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erreur serveur interne'
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🗂️  GED - Gestion Électronique des Documents            ║
║                                                            ║
║   Serveur démarré sur le port ${PORT}                        ║
║   URL: http://localhost:${PORT}                              ║
║                                                            ║
║   API Documentation:                                       ║
║   - Auth:       /api/auth                                  ║
║   - Documents:  /api/documents                             ║
║   - Folders:    /api/folders                               ║
║   - Users:      /api/users                                 ║
║   - Workflows:  /api/workflows                             ║
║   - Shares:     /api/shares                                ║
║   - Categories: /api/categories                            ║
║   - Stats:      /api/stats                                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
