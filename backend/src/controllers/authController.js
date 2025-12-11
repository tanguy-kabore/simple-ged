const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { logActivity } = require('../utils/logger');

// Inscription d'un nouvel utilisateur
exports.register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, department, roleId } = req.body;

        // Vérifier si l'email existe déjà
        const [existingUsers] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cet email est déjà utilisé'
            });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'utilisateur
        const uuid = uuidv4();
        const [result] = await pool.query(
            `INSERT INTO users (uuid, email, password, first_name, last_name, phone, department, role_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid, email, hashedPassword, firstName, lastName, phone, department, roleId || 3]
        );

        // Logger l'activité
        await logActivity({
            userId: req.user?.id,
            action: 'create',
            entityType: 'user',
            entityId: result.insertId,
            entityName: `${firstName} ${lastName}`,
            details: { email },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            data: { id: result.insertId, uuid, email }
        });
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'inscription'
        });
    }
};

// Connexion
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Rechercher l'utilisateur
        const [users] = await pool.query(
            `SELECT u.*, r.name as role_name, r.permissions 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }

        const user = users[0];

        // Vérifier si le compte est actif
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Compte désactivé. Contactez l\'administrateur.'
            });
        }

        // Vérifier le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }

        // Mettre à jour la dernière connexion
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Générer le token JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role_name },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Logger l'activité
        await logActivity({
            userId: user.id,
            action: 'login',
            entityType: 'user',
            entityId: user.id,
            entityName: `${user.first_name} ${user.last_name}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Connexion réussie',
            data: {
                token,
                user: {
                    id: user.id,
                    uuid: user.uuid,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role_name,
                    permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {}),
                    department: user.department,
                    avatar: user.avatar
                }
            }
        });
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion'
        });
    }
};

// Obtenir le profil utilisateur connecté
exports.getProfile = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.uuid, u.email, u.first_name, u.last_name, u.phone, 
                    u.avatar, u.department, u.created_at, u.last_login,
                    r.name as role_name, r.permissions
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const user = users[0];
        res.json({
            success: true,
            data: {
                id: user.id,
                uuid: user.uuid,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                avatar: user.avatar,
                department: user.department,
                role: user.role_name,
                permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {}),
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });
    } catch (error) {
        console.error('Erreur profil:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du profil'
        });
    }
};

// Mettre à jour le profil
exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, department } = req.body;

        await pool.query(
            `UPDATE users SET first_name = ?, last_name = ?, phone = ?, department = ?
             WHERE id = ?`,
            [firstName, lastName, phone, department, req.user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'update',
            entityType: 'user',
            entityId: req.user.id,
            entityName: `${firstName} ${lastName}`,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du profil'
        });
    }
};

// Changer le mot de passe
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Vérifier le mot de passe actuel
        const [users] = await pool.query(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        const isMatch = await bcrypt.compare(currentPassword, users[0].password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe actuel incorrect'
            });
        }

        // Hasher et mettre à jour le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'password_change',
            entityType: 'user',
            entityId: req.user.id,
            entityName: `${req.user.first_name} ${req.user.last_name}`,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Mot de passe modifié avec succès'
        });
    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de mot de passe'
        });
    }
};

// Déconnexion (côté client principalement, mais on log l'activité)
exports.logout = async (req, res) => {
    try {
        await logActivity({
            userId: req.user.id,
            action: 'logout',
            entityType: 'user',
            entityId: req.user.id,
            entityName: `${req.user.first_name} ${req.user.last_name}`,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Déconnexion réussie'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la déconnexion'
        });
    }
};
