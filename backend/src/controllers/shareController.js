const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { logActivity } = require('../utils/logger');

// Générer un token de partage sécurisé
const generateShareToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Créer un lien de partage
exports.createShareLink = async (req, res) => {
    try {
        const { documentId, folderId, password, canDownload, canEdit, maxAccess, expiresIn } = req.body;

        if (!documentId && !folderId) {
            return res.status(400).json({
                success: false,
                message: 'Document ou dossier requis'
            });
        }

        // Vérifier l'existence de l'élément
        if (documentId) {
            const [docs] = await pool.query(
                'SELECT id, title FROM documents WHERE id = ? OR uuid = ?',
                [documentId, documentId]
            );
            if (docs.length === 0) {
                return res.status(404).json({ success: false, message: 'Document non trouvé' });
            }
        }

        if (folderId) {
            const [folders] = await pool.query(
                'SELECT id, name FROM folders WHERE id = ? OR uuid = ?',
                [folderId, folderId]
            );
            if (folders.length === 0) {
                return res.status(404).json({ success: false, message: 'Dossier non trouvé' });
            }
        }

        const uuid = uuidv4();
        const shareToken = generateShareToken();
        let hashedPassword = null;

        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Calculer la date d'expiration
        let expiresAt = null;
        if (expiresIn) {
            expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
        }

        const [result] = await pool.query(
            `INSERT INTO shares 
             (uuid, document_id, folder_id, shared_by, share_type, share_token, 
              password, can_download, can_edit, max_access, expires_at)
             VALUES (?, ?, ?, ?, 'link', ?, ?, ?, ?, ?, ?)`,
            [
                uuid,
                documentId || null,
                folderId || null,
                req.user.id,
                shareToken,
                hashedPassword,
                canDownload !== false,
                canEdit === true,
                maxAccess || null,
                expiresAt
            ]
        );

        const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareToken}`;

        await logActivity({
            userId: req.user.id,
            action: 'share_create',
            entityType: 'share',
            entityId: result.insertId,
            details: { documentId, folderId, expiresIn },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Lien de partage créé',
            data: {
                id: result.insertId,
                uuid,
                shareUrl,
                token: shareToken,
                expiresAt,
                hasPassword: !!password
            }
        });
    } catch (error) {
        console.error('Erreur création partage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du lien de partage'
        });
    }
};

// Partager avec un utilisateur spécifique
exports.shareWithUser = async (req, res) => {
    try {
        const { documentId, folderId, userId, canView, canEdit, canDelete, canShare, canDownload, expiresIn } = req.body;

        if (!documentId && !folderId) {
            return res.status(400).json({
                success: false,
                message: 'Document ou dossier requis'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Utilisateur requis'
            });
        }

        // Vérifier l'utilisateur cible
        const [users] = await pool.query('SELECT id, email FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        let expiresAt = null;
        if (expiresIn) {
            expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
        }

        if (documentId) {
            // Vérifier si permission existe déjà
            const [existing] = await pool.query(
                'SELECT id FROM document_permissions WHERE document_id = ? AND user_id = ?',
                [documentId, userId]
            );

            if (existing.length > 0) {
                // Mettre à jour
                await pool.query(
                    `UPDATE document_permissions SET 
                     can_view = ?, can_edit = ?, can_delete = ?, can_share = ?, can_download = ?, expires_at = ?
                     WHERE id = ?`,
                    [canView !== false, canEdit === true, canDelete === true, canShare === true, canDownload !== false, expiresAt, existing[0].id]
                );
            } else {
                // Créer
                await pool.query(
                    `INSERT INTO document_permissions 
                     (document_id, user_id, can_view, can_edit, can_delete, can_share, can_download, granted_by, expires_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [documentId, userId, canView !== false, canEdit === true, canDelete === true, canShare === true, canDownload !== false, req.user.id, expiresAt]
                );
            }
        }

        if (folderId) {
            const [existing] = await pool.query(
                'SELECT id FROM folder_permissions WHERE folder_id = ? AND user_id = ?',
                [folderId, userId]
            );

            if (existing.length > 0) {
                await pool.query(
                    `UPDATE folder_permissions SET 
                     can_view = ?, can_edit = ?, can_delete = ?, can_share = ?, can_upload = ?, expires_at = ?
                     WHERE id = ?`,
                    [canView !== false, canEdit === true, canDelete === true, canShare === true, canEdit === true, expiresAt, existing[0].id]
                );
            } else {
                await pool.query(
                    `INSERT INTO folder_permissions 
                     (folder_id, user_id, can_view, can_edit, can_delete, can_share, can_upload, granted_by, expires_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [folderId, userId, canView !== false, canEdit === true, canDelete === true, canShare === true, canEdit === true, req.user.id, expiresAt]
                );
            }
        }

        await logActivity({
            userId: req.user.id,
            action: 'share_user',
            entityType: 'share',
            details: { documentId, folderId, targetUserId: userId },
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Partage effectué avec succès'
        });
    } catch (error) {
        console.error('Erreur partage utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du partage'
        });
    }
};

// Accéder à un contenu partagé via token
exports.accessShare = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const [shares] = await pool.query(
            `SELECT s.*, d.title as doc_title, d.uuid as doc_uuid, d.file_name, d.file_type, d.file_size,
                    f.name as folder_name, f.uuid as folder_uuid,
                    u.first_name, u.last_name
             FROM shares s
             LEFT JOIN documents d ON s.document_id = d.id
             LEFT JOIN folders f ON s.folder_id = f.id
             JOIN users u ON s.shared_by = u.id
             WHERE s.share_token = ?`,
            [token]
        );

        if (shares.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lien de partage invalide'
            });
        }

        const share = shares[0];

        // Vérifier l'expiration
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return res.status(410).json({
                success: false,
                message: 'Ce lien de partage a expiré'
            });
        }

        // Vérifier le nombre d'accès
        if (share.max_access && share.access_count >= share.max_access) {
            return res.status(410).json({
                success: false,
                message: 'Nombre maximum d\'accès atteint'
            });
        }

        // Vérifier le mot de passe si nécessaire
        if (share.password) {
            if (!password) {
                return res.status(401).json({
                    success: false,
                    message: 'Mot de passe requis',
                    requiresPassword: true
                });
            }

            const isMatch = await bcrypt.compare(password, share.password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Mot de passe incorrect'
                });
            }
        }

        // Incrémenter le compteur d'accès
        await pool.query(
            'UPDATE shares SET access_count = access_count + 1 WHERE id = ?',
            [share.id]
        );

        const response = {
            success: true,
            data: {
                type: share.document_id ? 'document' : 'folder',
                canDownload: share.can_download,
                canEdit: share.can_edit,
                sharedBy: `${share.first_name} ${share.last_name}`
            }
        };

        if (share.document_id) {
            response.data.document = {
                uuid: share.doc_uuid,
                title: share.doc_title,
                fileName: share.file_name,
                fileType: share.file_type,
                fileSize: share.file_size
            };
        }

        if (share.folder_id) {
            response.data.folder = {
                uuid: share.folder_uuid,
                name: share.folder_name
            };

            // Récupérer le contenu du dossier
            const [contents] = await pool.query(
                `SELECT id, uuid, title, file_name, file_type, file_size FROM documents 
                 WHERE folder_id = ? AND is_archived = FALSE`,
                [share.folder_id]
            );
            response.data.folder.documents = contents;
        }

        res.json(response);
    } catch (error) {
        console.error('Erreur accès partage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'accès au partage'
        });
    }
};

// Obtenir les partages d'un document
exports.getDocumentShares = async (req, res) => {
    try {
        const { documentId } = req.params;

        // Liens de partage
        const [links] = await pool.query(
            `SELECT s.*, u.first_name, u.last_name
             FROM shares s
             JOIN users u ON s.shared_by = u.id
             WHERE s.document_id = ?
             ORDER BY s.created_at DESC`,
            [documentId]
        );

        // Partages utilisateurs
        const [userShares] = await pool.query(
            `SELECT dp.*, u.first_name, u.last_name, u.email,
                    ug.first_name as granted_first, ug.last_name as granted_last
             FROM document_permissions dp
             JOIN users u ON dp.user_id = u.id
             JOIN users ug ON dp.granted_by = ug.id
             WHERE dp.document_id = ?`,
            [documentId]
        );

        res.json({
            success: true,
            data: {
                links: links.map(l => ({
                    id: l.id,
                    uuid: l.uuid,
                    token: l.share_token,
                    hasPassword: !!l.password,
                    canDownload: l.can_download,
                    canEdit: l.can_edit,
                    accessCount: l.access_count,
                    maxAccess: l.max_access,
                    expiresAt: l.expires_at,
                    createdBy: `${l.first_name} ${l.last_name}`,
                    createdAt: l.created_at
                })),
                users: userShares.map(u => ({
                    id: u.id,
                    user: {
                        id: u.user_id,
                        name: `${u.first_name} ${u.last_name}`,
                        email: u.email
                    },
                    permissions: {
                        canView: u.can_view,
                        canEdit: u.can_edit,
                        canDelete: u.can_delete,
                        canShare: u.can_share,
                        canDownload: u.can_download
                    },
                    grantedBy: `${u.granted_first} ${u.granted_last}`,
                    expiresAt: u.expires_at,
                    createdAt: u.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Erreur récupération partages:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des partages'
        });
    }
};

// Révoquer un partage
exports.revokeShare = async (req, res) => {
    try {
        const { shareId } = req.params;
        const { type } = req.query; // 'link' ou 'user'

        if (type === 'link') {
            await pool.query('DELETE FROM shares WHERE id = ?', [shareId]);
        } else if (type === 'document') {
            await pool.query('DELETE FROM document_permissions WHERE id = ?', [shareId]);
        } else if (type === 'folder') {
            await pool.query('DELETE FROM folder_permissions WHERE id = ?', [shareId]);
        }

        await logActivity({
            userId: req.user.id,
            action: 'share_revoke',
            entityType: 'share',
            entityId: shareId,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Partage révoqué avec succès'
        });
    } catch (error) {
        console.error('Erreur révocation partage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la révocation du partage'
        });
    }
};
