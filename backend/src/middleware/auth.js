const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Middleware d'authentification JWT
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token d\'authentification manquant' 
            });
        }

        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Vérifier que l'utilisateur existe et est actif
            const [users] = await pool.query(
                `SELECT u.*, r.name as role_name, r.permissions 
                 FROM users u 
                 JOIN roles r ON u.role_id = r.id 
                 WHERE u.id = ? AND u.is_active = TRUE`,
                [decoded.userId]
            );

            if (users.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Utilisateur non trouvé ou inactif' 
                });
            }

            req.user = users[0];
            req.user.permissions = typeof users[0].permissions === 'string' 
                ? JSON.parse(users[0].permissions || '{}') 
                : (users[0].permissions || {});
            next();
        } catch (jwtError) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token invalide ou expiré' 
            });
        }
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur lors de l\'authentification' 
        });
    }
};

// Middleware de vérification des rôles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Non authentifié' 
            });
        }

        if (!roles.includes(req.user.role_name)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Accès non autorisé pour ce rôle' 
            });
        }

        next();
    };
};

// Middleware de vérification des permissions
const checkPermission = (entity, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Non authentifié' 
            });
        }

        const permissions = req.user.permissions;

        // Admin a tous les droits
        if (permissions.all === true) {
            return next();
        }

        // Vérifier la permission spécifique
        if (permissions[entity] && permissions[entity][action]) {
            return next();
        }

        return res.status(403).json({ 
            success: false, 
            message: `Permission '${action}' sur '${entity}' non autorisée` 
        });
    };
};

module.exports = { authenticate, authorize, checkPermission };
