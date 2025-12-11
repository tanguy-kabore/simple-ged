const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { logActivity } = require('../utils/logger');

// Obtenir tous les utilisateurs
exports.getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role, department, active } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role) {
            whereClause += ' AND r.name = ?';
            params.push(role);
        }

        if (department) {
            whereClause += ' AND u.department = ?';
            params.push(department);
        }

        if (active !== undefined) {
            whereClause += ' AND u.is_active = ?';
            params.push(active === 'true');
        }

        const [users] = await pool.query(
            `SELECT u.id, u.uuid, u.email, u.first_name, u.last_name, u.phone,
                    u.avatar, u.department, u.is_active, u.last_login, u.created_at,
                    r.id as role_id, r.name as role_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             ${whereClause}
             ORDER BY u.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id ${whereClause}`,
            params
        );

        res.json({
            success: true,
            data: {
                users: users.map(u => ({
                    id: u.id,
                    uuid: u.uuid,
                    email: u.email,
                    firstName: u.first_name,
                    lastName: u.last_name,
                    phone: u.phone,
                    avatar: u.avatar,
                    department: u.department,
                    role: { id: u.role_id, name: u.role_name },
                    isActive: u.is_active,
                    lastLogin: u.last_login,
                    createdAt: u.created_at
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Erreur récupération utilisateurs:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs'
        });
    }
};

// Obtenir un utilisateur par ID
exports.getUser = async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.query(
            `SELECT u.*, r.name as role_name, r.permissions
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = ? OR u.uuid = ?`,
            [id, id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const user = users[0];

        // Statistiques utilisateur
        const [docStats] = await pool.query(
            'SELECT COUNT(*) as count FROM documents WHERE owner_id = ?',
            [user.id]
        );

        const [folderStats] = await pool.query(
            'SELECT COUNT(*) as count FROM folders WHERE owner_id = ?',
            [user.id]
        );

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
                role: {
                    id: user.role_id,
                    name: user.role_name,
                    permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {})
                },
                isActive: user.is_active,
                lastLogin: user.last_login,
                createdAt: user.created_at,
                stats: {
                    documents: docStats[0].count,
                    folders: folderStats[0].count
                }
            }
        });
    } catch (error) {
        console.error('Erreur récupération utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'utilisateur'
        });
    }
};

// Créer un utilisateur (admin)
exports.createUser = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, department, roleId } = req.body;

        // Vérifier si l'email existe
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cet email est déjà utilisé'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const uuid = uuidv4();

        const [result] = await pool.query(
            `INSERT INTO users (uuid, email, password, first_name, last_name, phone, department, role_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid, email, hashedPassword, firstName, lastName, phone, department, roleId || 3]
        );

        await logActivity({
            userId: req.user.id,
            action: 'create',
            entityType: 'user',
            entityId: result.insertId,
            entityName: `${firstName} ${lastName}`,
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            data: { id: result.insertId, uuid, email }
        });
    } catch (error) {
        console.error('Erreur création utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'utilisateur'
        });
    }
};

// Mettre à jour un utilisateur
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, department, roleId, isActive } = req.body;

        const [users] = await pool.query('SELECT * FROM users WHERE id = ? OR uuid = ?', [id, id]);
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const user = users[0];

        await pool.query(
            `UPDATE users SET 
             first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone),
             department = COALESCE(?, department),
             role_id = COALESCE(?, role_id),
             is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [firstName, lastName, phone, department, roleId, isActive, user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'update',
            entityType: 'user',
            entityId: user.id,
            entityName: `${firstName || user.first_name} ${lastName || user.last_name}`,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Utilisateur mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'utilisateur'
        });
    }
};

// Supprimer un utilisateur
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.query('SELECT * FROM users WHERE id = ? OR uuid = ?', [id, id]);
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const user = users[0];

        // Ne pas supprimer l'admin principal
        if (user.email === 'admin@ged.local') {
            return res.status(403).json({
                success: false,
                message: 'Impossible de supprimer l\'administrateur principal'
            });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [user.id]);

        await logActivity({
            userId: req.user.id,
            action: 'delete',
            entityType: 'user',
            entityId: user.id,
            entityName: `${user.first_name} ${user.last_name}`,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Utilisateur supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'utilisateur'
        });
    }
};

// Réinitialiser le mot de passe (admin)
exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        const [users] = await pool.query('SELECT * FROM users WHERE id = ? OR uuid = ?', [id, id]);
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, users[0].id]);

        await logActivity({
            userId: req.user.id,
            action: 'password_reset',
            entityType: 'user',
            entityId: users[0].id,
            entityName: `${users[0].first_name} ${users[0].last_name}`,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès'
        });
    } catch (error) {
        console.error('Erreur réinitialisation mot de passe:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la réinitialisation du mot de passe'
        });
    }
};

// Obtenir tous les rôles
exports.getRoles = async (req, res) => {
    try {
        const [roles] = await pool.query('SELECT * FROM roles ORDER BY id');

        res.json({
            success: true,
            data: roles.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description,
                permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '{}') : (r.permissions || {})
            }))
        });
    } catch (error) {
        console.error('Erreur récupération rôles:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des rôles'
        });
    }
};

// Obtenir les départements uniques
exports.getDepartments = async (req, res) => {
    try {
        const [departments] = await pool.query(
            'SELECT DISTINCT department FROM users WHERE department IS NOT NULL ORDER BY department'
        );

        res.json({
            success: true,
            data: departments.map(d => d.department)
        });
    } catch (error) {
        console.error('Erreur récupération départements:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements'
        });
    }
};
