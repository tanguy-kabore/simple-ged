const pool = require('../config/database');

// Dashboard - Statistiques générales
exports.getDashboard = async (req, res) => {
    try {
        // Statistiques documents
        const [docStats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_archived = FALSE THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_archived = TRUE THEN 1 ELSE 0 END) as archived,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(file_size) as total_size
            FROM documents
        `);

        // Statistiques dossiers
        const [folderStats] = await pool.query(`
            SELECT COUNT(*) as total FROM folders WHERE is_archived = FALSE
        `);

        // Statistiques utilisateurs
        const [userStats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active
            FROM users
        `);

        // Workflows en cours
        const [workflowStats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as completed
            FROM workflow_instances
        `);

        // Documents récents
        const [recentDocs] = await pool.query(`
            SELECT d.id, d.uuid, d.title, d.file_type, d.created_at,
                   u.first_name, u.last_name
            FROM documents d
            JOIN users u ON d.owner_id = u.id
            WHERE d.is_archived = FALSE
            ORDER BY d.created_at DESC
            LIMIT 5
        `);

        // Activité récente
        const [recentActivity] = await pool.query(`
            SELECT al.*, u.first_name, u.last_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);

        // Documents par catégorie
        const [docsByCategory] = await pool.query(`
            SELECT c.name, c.color, COUNT(d.id) as count
            FROM categories c
            LEFT JOIN documents d ON c.id = d.category_id AND d.is_archived = FALSE
            GROUP BY c.id
            ORDER BY count DESC
        `);

        // Évolution mensuelle (6 derniers mois)
        const [monthlyTrend] = await pool.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as count
            FROM documents
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        res.json({
            success: true,
            data: {
                overview: {
                    documents: {
                        total: docStats[0].total,
                        active: docStats[0].active,
                        archived: docStats[0].archived,
                        draft: docStats[0].draft,
                        pending: docStats[0].pending,
                        approved: docStats[0].approved,
                        totalSize: docStats[0].total_size
                    },
                    folders: folderStats[0].total,
                    users: {
                        total: userStats[0].total,
                        active: userStats[0].active
                    },
                    workflows: {
                        total: workflowStats[0].total,
                        inProgress: workflowStats[0].in_progress,
                        completed: workflowStats[0].completed
                    }
                },
                recentDocuments: recentDocs.map(d => ({
                    id: d.id,
                    uuid: d.uuid,
                    title: d.title,
                    fileType: d.file_type,
                    owner: `${d.first_name} ${d.last_name}`,
                    createdAt: d.created_at
                })),
                recentActivity: recentActivity.map(a => ({
                    id: a.id,
                    action: a.action,
                    entityType: a.entity_type,
                    entityName: a.entity_name,
                    user: a.first_name ? `${a.first_name} ${a.last_name}` : 'Système',
                    createdAt: a.created_at
                })),
                charts: {
                    byCategory: docsByCategory,
                    monthlyTrend: monthlyTrend
                }
            }
        });
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard'
        });
    }
};

// Statistiques de stockage
exports.getStorageStats = async (req, res) => {
    try {
        // Par type de fichier
        const [byType] = await pool.query(`
            SELECT file_type, COUNT(*) as count, SUM(file_size) as size
            FROM documents
            WHERE is_archived = FALSE
            GROUP BY file_type
            ORDER BY size DESC
        `);

        // Par utilisateur
        const [byUser] = await pool.query(`
            SELECT u.id, u.first_name, u.last_name, 
                   COUNT(d.id) as doc_count, 
                   COALESCE(SUM(d.file_size), 0) as total_size
            FROM users u
            LEFT JOIN documents d ON u.id = d.owner_id
            GROUP BY u.id
            ORDER BY total_size DESC
            LIMIT 10
        `);

        // Par mois
        const [byMonth] = await pool.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                SUM(file_size) as size,
                COUNT(*) as count
            FROM documents
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        res.json({
            success: true,
            data: {
                byType: byType.map(t => ({
                    type: t.file_type,
                    count: t.count,
                    size: t.size
                })),
                byUser: byUser.map(u => ({
                    id: u.id,
                    name: `${u.first_name} ${u.last_name}`,
                    documentCount: u.doc_count,
                    totalSize: u.total_size
                })),
                byMonth
            }
        });
    } catch (error) {
        console.error('Erreur stats stockage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques de stockage'
        });
    }
};

// Journal d'activité
exports.getActivityLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            userId,
            action,
            entityType,
            startDate,
            endDate
        } = req.query;

        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (userId) {
            whereClause += ' AND al.user_id = ?';
            params.push(userId);
        }

        if (action) {
            whereClause += ' AND al.action = ?';
            params.push(action);
        }

        if (entityType) {
            whereClause += ' AND al.entity_type = ?';
            params.push(entityType);
        }

        if (startDate) {
            whereClause += ' AND al.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND al.created_at <= ?';
            params.push(endDate);
        }

        const [logs] = await pool.query(
            `SELECT al.*, u.first_name, u.last_name, u.email
             FROM activity_logs al
             LEFT JOIN users u ON al.user_id = u.id
             ${whereClause}
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`,
            params
        );

        res.json({
            success: true,
            data: {
                logs: logs.map(l => ({
                    id: l.id,
                    user: l.first_name ? {
                        id: l.user_id,
                        name: `${l.first_name} ${l.last_name}`,
                        email: l.email
                    } : null,
                    action: l.action,
                    entityType: l.entity_type,
                    entityId: l.entity_id,
                    entityName: l.entity_name,
                    details: l.details ? (typeof l.details === 'string' ? JSON.parse(l.details) : l.details) : null,
                    ipAddress: l.ip_address,
                    createdAt: l.created_at
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
        console.error('Erreur logs activité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des logs'
        });
    }
};

// Notifications de l'utilisateur
exports.getNotifications = async (req, res) => {
    try {
        const { unreadOnly } = req.query;

        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [req.user.id];

        if (unreadOnly === 'true') {
            query += ' AND is_read = FALSE';
        }

        query += ' ORDER BY created_at DESC LIMIT 50';

        const [notifications] = await pool.query(query, params);

        const [unreadCount] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        res.json({
            success: true,
            data: {
                notifications: notifications.map(n => ({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    link: n.link,
                    isRead: n.is_read,
                    createdAt: n.created_at
                })),
                unreadCount: unreadCount[0].count
            }
        });
    } catch (error) {
        console.error('Erreur notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des notifications'
        });
    }
};

// Marquer les notifications comme lues
exports.markNotificationsRead = async (req, res) => {
    try {
        const { ids } = req.body;

        if (ids && Array.isArray(ids)) {
            await pool.query(
                'UPDATE notifications SET is_read = TRUE WHERE id IN (?) AND user_id = ?',
                [ids, req.user.id]
            );
        } else {
            await pool.query(
                'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
                [req.user.id]
            );
        }

        res.json({
            success: true,
            message: 'Notifications marquées comme lues'
        });
    } catch (error) {
        console.error('Erreur marquage notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage des notifications'
        });
    }
};

// Favoris de l'utilisateur
exports.getFavorites = async (req, res) => {
    try {
        const [favorites] = await pool.query(
            `SELECT f.*, 
                    d.uuid as doc_uuid, d.title as doc_title, d.file_type, d.file_size,
                    fo.uuid as folder_uuid, fo.name as folder_name
             FROM favorites f
             LEFT JOIN documents d ON f.document_id = d.id
             LEFT JOIN folders fo ON f.folder_id = fo.id
             WHERE f.user_id = ?
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: favorites.map(f => ({
                id: f.id,
                type: f.document_id ? 'document' : 'folder',
                document: f.document_id ? {
                    id: f.document_id,
                    uuid: f.doc_uuid,
                    title: f.doc_title,
                    fileType: f.file_type,
                    fileSize: f.file_size
                } : null,
                folder: f.folder_id ? {
                    id: f.folder_id,
                    uuid: f.folder_uuid,
                    name: f.folder_name
                } : null,
                createdAt: f.created_at
            }))
        });
    } catch (error) {
        console.error('Erreur favoris:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des favoris'
        });
    }
};

// Ajouter aux favoris
exports.addFavorite = async (req, res) => {
    try {
        const { documentId, folderId } = req.body;

        // Vérifier si déjà en favori
        const [existing] = await pool.query(
            `SELECT id FROM favorites 
             WHERE user_id = ? AND (document_id = ? OR folder_id = ?)`,
            [req.user.id, documentId || null, folderId || null]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Déjà en favoris'
            });
        }

        await pool.query(
            'INSERT INTO favorites (user_id, document_id, folder_id) VALUES (?, ?, ?)',
            [req.user.id, documentId || null, folderId || null]
        );

        res.status(201).json({
            success: true,
            message: 'Ajouté aux favoris'
        });
    } catch (error) {
        console.error('Erreur ajout favori:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'ajout aux favoris'
        });
    }
};

// Supprimer des favoris
exports.removeFavorite = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'DELETE FROM favorites WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );

        res.json({
            success: true,
            message: 'Retiré des favoris'
        });
    } catch (error) {
        console.error('Erreur suppression favori:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du favori'
        });
    }
};
