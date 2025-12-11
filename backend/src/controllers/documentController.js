const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('../config/database');
const { logActivity } = require('../utils/logger');

// Calculer le checksum d'un fichier
const calculateChecksum = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', reject);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

// Upload d'un document
exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        const { title, description, folderId, categoryId, tags } = req.body;
        const file = req.file;

        // Calculer le checksum
        const checksum = await calculateChecksum(file.path);

        // Créer le document
        const uuid = uuidv4();
        const [result] = await pool.query(
            `INSERT INTO documents 
             (uuid, title, description, file_name, file_path, file_type, file_size, mime_type, 
              folder_id, category_id, owner_id, checksum, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuid,
                title || file.originalname,
                description || null,
                file.originalname,
                file.path,
                path.extname(file.originalname).replace('.', ''),
                file.size,
                file.mimetype,
                folderId || null,
                categoryId || null,
                req.user.id,
                checksum,
                tags ? JSON.stringify(tags.split(',').map(t => t.trim())) : null
            ]
        );

        // Créer la première version
        await pool.query(
            `INSERT INTO document_versions 
             (document_id, version_number, file_name, file_path, file_size, checksum, comment, created_by)
             VALUES (?, 1, ?, ?, ?, ?, 'Version initiale', ?)`,
            [result.insertId, file.originalname, file.path, file.size, checksum, req.user.id]
        );

        // Logger l'activité
        await logActivity({
            userId: req.user.id,
            action: 'upload',
            entityType: 'document',
            entityId: result.insertId,
            entityName: title || file.originalname,
            details: { fileSize: file.size, fileType: file.mimetype },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Document uploadé avec succès',
            data: {
                id: result.insertId,
                uuid,
                title: title || file.originalname,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype
            }
        });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'upload du document'
        });
    }
};

// Upload multiple de documents
exports.uploadMultiple = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        const { folderId, categoryId } = req.body;
        const uploadedDocs = [];

        for (const file of req.files) {
            const checksum = await calculateChecksum(file.path);
            const uuid = uuidv4();

            const [result] = await pool.query(
                `INSERT INTO documents 
                 (uuid, title, file_name, file_path, file_type, file_size, mime_type, 
                  folder_id, category_id, owner_id, checksum)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uuid,
                    file.originalname,
                    file.originalname,
                    file.path,
                    path.extname(file.originalname).replace('.', ''),
                    file.size,
                    file.mimetype,
                    folderId || null,
                    categoryId || null,
                    req.user.id,
                    checksum
                ]
            );

            await pool.query(
                `INSERT INTO document_versions 
                 (document_id, version_number, file_name, file_path, file_size, checksum, comment, created_by)
                 VALUES (?, 1, ?, ?, ?, ?, 'Version initiale', ?)`,
                [result.insertId, file.originalname, file.path, file.size, checksum, req.user.id]
            );

            uploadedDocs.push({
                id: result.insertId,
                uuid,
                fileName: file.originalname,
                fileSize: file.size
            });
        }

        await logActivity({
            userId: req.user.id,
            action: 'upload_multiple',
            entityType: 'document',
            entityId: null,
            entityName: `${req.files.length} documents`,
            details: { count: req.files.length },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: `${req.files.length} document(s) uploadé(s) avec succès`,
            data: uploadedDocs
        });
    } catch (error) {
        console.error('Erreur upload multiple:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'upload des documents'
        });
    }
};

// Obtenir tous les documents (avec filtres et pagination)
exports.getDocuments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            categoryId,
            folderId,
            status,
            ownerId,
            startDate,
            endDate,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        // Gestion des documents archivés
        if (status === 'archived') {
            whereClause += ' AND d.is_archived = TRUE';
        } else if (status) {
            whereClause += ' AND d.is_archived = FALSE AND d.status = ?';
            params.push(status);
        } else {
            whereClause += ' AND d.is_archived = FALSE';
        }

        // Filtres
        if (search) {
            whereClause += ' AND (d.title LIKE ? OR d.description LIKE ? OR MATCH(d.title, d.description) AGAINST(?))';
            params.push(`%${search}%`, `%${search}%`, search);
        }

        if (categoryId) {
            whereClause += ' AND d.category_id = ?';
            params.push(categoryId);
        }

        if (folderId) {
            whereClause += ' AND d.folder_id = ?';
            params.push(folderId);
        }

        if (ownerId) {
            whereClause += ' AND d.owner_id = ?';
            params.push(ownerId);
        }

        if (startDate) {
            whereClause += ' AND d.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND d.created_at <= ?';
            params.push(endDate);
        }

        // Vérifier les permissions (guest ne voit que les documents partagés)
        if (req.user.role_name === 'guest') {
            whereClause += ` AND (d.owner_id = ? OR EXISTS (
                SELECT 1 FROM document_permissions dp 
                WHERE dp.document_id = d.id AND (dp.user_id = ? OR dp.role_id = ?)
            ))`;
            params.push(req.user.id, req.user.id, req.user.role_id);
        }

        // Requête principale
        const [documents] = await pool.query(
            `SELECT d.*, 
                    u.first_name as owner_first_name, u.last_name as owner_last_name,
                    c.name as category_name, c.color as category_color,
                    f.name as folder_name
             FROM documents d
             LEFT JOIN users u ON d.owner_id = u.id
             LEFT JOIN categories c ON d.category_id = c.id
             LEFT JOIN folders f ON d.folder_id = f.id
             ${whereClause}
             ORDER BY d.${sortBy} ${sortOrder}
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        // Compter le total
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM documents d ${whereClause}`,
            params
        );

        res.json({
            success: true,
            data: {
                documents: documents.map(doc => ({
                    id: doc.id,
                    uuid: doc.uuid,
                    title: doc.title,
                    description: doc.description,
                    fileName: doc.file_name,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    mimeType: doc.mime_type,
                    status: doc.status,
                    currentVersion: doc.current_version,
                    isLocked: doc.is_locked,
                    tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : [],
                    owner: {
                        id: doc.owner_id,
                        name: `${doc.owner_first_name} ${doc.owner_last_name}`
                    },
                    category: doc.category_id ? {
                        id: doc.category_id,
                        name: doc.category_name,
                        color: doc.category_color
                    } : null,
                    folder: doc.folder_id ? {
                        id: doc.folder_id,
                        name: doc.folder_name
                    } : null,
                    createdAt: doc.created_at,
                    updatedAt: doc.updated_at
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
        console.error('Erreur récupération documents:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des documents'
        });
    }
};

// Obtenir un document par ID
exports.getDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const [documents] = await pool.query(
            `SELECT d.*, 
                    u.first_name as owner_first_name, u.last_name as owner_last_name, u.email as owner_email,
                    c.name as category_name, c.color as category_color,
                    f.name as folder_name, f.uuid as folder_uuid,
                    lu.first_name as locked_by_first_name, lu.last_name as locked_by_last_name
             FROM documents d
             LEFT JOIN users u ON d.owner_id = u.id
             LEFT JOIN categories c ON d.category_id = c.id
             LEFT JOIN folders f ON d.folder_id = f.id
             LEFT JOIN users lu ON d.locked_by = lu.id
             WHERE d.id = ? OR d.uuid = ?`,
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        // Récupérer les versions
        const [versions] = await pool.query(
            `SELECT dv.*, u.first_name, u.last_name
             FROM document_versions dv
             JOIN users u ON dv.created_by = u.id
             WHERE dv.document_id = ?
             ORDER BY dv.version_number DESC`,
            [doc.id]
        );

        // Récupérer les commentaires
        const [comments] = await pool.query(
            `SELECT dc.*, u.first_name, u.last_name, u.avatar
             FROM document_comments dc
             JOIN users u ON dc.user_id = u.id
             WHERE dc.document_id = ?
             ORDER BY dc.created_at DESC`,
            [doc.id]
        );

        // Logger la consultation
        await logActivity({
            userId: req.user.id,
            action: 'view',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            ip: req.ip
        });

        res.json({
            success: true,
            data: {
                id: doc.id,
                uuid: doc.uuid,
                title: doc.title,
                description: doc.description,
                fileName: doc.file_name,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                mimeType: doc.mime_type,
                status: doc.status,
                currentVersion: doc.current_version,
                isLocked: doc.is_locked,
                lockedBy: doc.is_locked ? {
                    name: `${doc.locked_by_first_name} ${doc.locked_by_last_name}`,
                    at: doc.locked_at
                } : null,
                isArchived: doc.is_archived,
                tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : [],
                metadata: doc.metadata ? (typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata) : {},
                checksum: doc.checksum,
                owner: {
                    id: doc.owner_id,
                    name: `${doc.owner_first_name} ${doc.owner_last_name}`,
                    email: doc.owner_email
                },
                category: doc.category_id ? {
                    id: doc.category_id,
                    name: doc.category_name,
                    color: doc.category_color
                } : null,
                folder: doc.folder_id ? {
                    id: doc.folder_id,
                    uuid: doc.folder_uuid,
                    name: doc.folder_name
                } : null,
                versions: versions.map(v => ({
                    id: v.id,
                    versionNumber: v.version_number,
                    fileName: v.file_name,
                    fileSize: v.file_size,
                    comment: v.comment,
                    createdBy: `${v.first_name} ${v.last_name}`,
                    createdAt: v.created_at
                })),
                comments: comments.map(c => ({
                    id: c.id,
                    content: c.content,
                    user: {
                        id: c.user_id,
                        name: `${c.first_name} ${c.last_name}`,
                        avatar: c.avatar
                    },
                    createdAt: c.created_at
                })),
                createdAt: doc.created_at,
                updatedAt: doc.updated_at
            }
        });
    } catch (error) {
        console.error('Erreur récupération document:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du document'
        });
    }
};

// Mettre à jour un document
exports.updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, categoryId, folderId, tags, status } = req.body;

        // Vérifier que le document existe
        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        // Vérifier le verrouillage
        if (doc.is_locked && doc.locked_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Document verrouillé par un autre utilisateur'
            });
        }

        // Construire la requête de mise à jour dynamiquement
        const updates = [];
        const params = [];

        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (categoryId !== undefined) { updates.push('category_id = ?'); params.push(categoryId || null); }
        if (folderId !== undefined) { updates.push('folder_id = ?'); params.push(folderId || null); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags ? JSON.stringify(tags) : null); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune modification fournie'
            });
        }

        params.push(doc.id);
        await pool.query(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`, params);

        await logActivity({
            userId: req.user.id,
            action: 'update',
            entityType: 'document',
            entityId: doc.id,
            entityName: title || doc.title,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Document mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour document:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du document'
        });
    }
};

// Supprimer un document
exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        // Supprimer le fichier physique
        if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
        }

        // Supprimer les versions
        const [versions] = await pool.query(
            'SELECT file_path FROM document_versions WHERE document_id = ?',
            [doc.id]
        );

        for (const version of versions) {
            if (fs.existsSync(version.file_path)) {
                fs.unlinkSync(version.file_path);
            }
        }

        // Supprimer de la base
        await pool.query('DELETE FROM documents WHERE id = ?', [doc.id]);

        await logActivity({
            userId: req.user.id,
            action: 'delete',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Document supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression document:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du document'
        });
    }
};

// Télécharger un document
exports.downloadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { version } = req.query;

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];
        let filePath = doc.file_path;
        let fileName = doc.file_name;

        // Si une version spécifique est demandée
        if (version) {
            const [versions] = await pool.query(
                'SELECT * FROM document_versions WHERE document_id = ? AND version_number = ?',
                [doc.id, version]
            );

            if (versions.length > 0) {
                filePath = versions[0].file_path;
                fileName = versions[0].file_name;
            }
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Fichier non trouvé sur le serveur'
            });
        }

        await logActivity({
            userId: req.user.id,
            action: 'download',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            details: { version: version || doc.current_version },
            ip: req.ip
        });

        res.download(filePath, fileName);
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement'
        });
    }
};

// Créer une nouvelle version
exports.createVersion = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];
        const newVersion = doc.current_version + 1;
        const checksum = await calculateChecksum(req.file.path);

        // Créer la nouvelle version
        await pool.query(
            `INSERT INTO document_versions 
             (document_id, version_number, file_name, file_path, file_size, checksum, comment, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [doc.id, newVersion, req.file.originalname, req.file.path, req.file.size, checksum, comment, req.user.id]
        );

        // Mettre à jour le document
        await pool.query(
            `UPDATE documents SET 
             current_version = ?, file_name = ?, file_path = ?, file_size = ?, checksum = ?
             WHERE id = ?`,
            [newVersion, req.file.originalname, req.file.path, req.file.size, checksum, doc.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'version_create',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            details: { version: newVersion, comment },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: `Version ${newVersion} créée avec succès`,
            data: { version: newVersion }
        });
    } catch (error) {
        console.error('Erreur création version:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la version'
        });
    }
};

// Verrouiller/Déverrouiller un document
exports.toggleLock = async (req, res) => {
    try {
        const { id } = req.params;

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        if (doc.is_locked && doc.locked_by !== req.user.id && req.user.role_name !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Seul l\'utilisateur qui a verrouillé ou un admin peut déverrouiller'
            });
        }

        const newLockState = !doc.is_locked;

        await pool.query(
            `UPDATE documents SET 
             is_locked = ?, locked_by = ?, locked_at = ?
             WHERE id = ?`,
            [newLockState, newLockState ? req.user.id : null, newLockState ? new Date() : null, doc.id]
        );

        await logActivity({
            userId: req.user.id,
            action: newLockState ? 'lock' : 'unlock',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            ip: req.ip
        });

        res.json({
            success: true,
            message: `Document ${newLockState ? 'verrouillé' : 'déverrouillé'} avec succès`
        });
    } catch (error) {
        console.error('Erreur verrouillage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du verrouillage/déverrouillage'
        });
    }
};

// Archiver un document
exports.archiveDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        await pool.query(
            'UPDATE documents SET is_archived = TRUE, archived_at = NOW(), status = "archived" WHERE id = ?',
            [doc.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'archive',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Document archivé avec succès'
        });
    } catch (error) {
        console.error('Erreur archivage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'archivage'
        });
    }
};

// Ajouter un commentaire
exports.addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, parentId } = req.body;

        const [documents] = await pool.query(
            'SELECT id, title FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO document_comments (document_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
            [documents[0].id, req.user.id, parentId || null, content]
        );

        res.status(201).json({
            success: true,
            message: 'Commentaire ajouté',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Erreur ajout commentaire:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'ajout du commentaire'
        });
    }
};

// Recherche avancée
exports.searchDocuments = async (req, res) => {
    try {
        const { q, category, type, dateFrom, dateTo, owner, status, page = 1, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Terme de recherche trop court (minimum 2 caractères)'
            });
        }

        const offset = (page - 1) * limit;
        let whereClause = 'WHERE d.is_archived = FALSE AND (MATCH(d.title, d.description) AGAINST(? IN BOOLEAN MODE) OR d.title LIKE ? OR d.file_name LIKE ?)';
        const params = [q, `%${q}%`, `%${q}%`];

        if (category) {
            whereClause += ' AND d.category_id = ?';
            params.push(category);
        }

        if (type) {
            whereClause += ' AND d.file_type = ?';
            params.push(type);
        }

        if (dateFrom) {
            whereClause += ' AND d.created_at >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            whereClause += ' AND d.created_at <= ?';
            params.push(dateTo);
        }

        if (owner) {
            whereClause += ' AND d.owner_id = ?';
            params.push(owner);
        }

        if (status) {
            whereClause += ' AND d.status = ?';
            params.push(status);
        }

        const [documents] = await pool.query(
            `SELECT d.id, d.uuid, d.title, d.description, d.file_name, d.file_type, 
                    d.file_size, d.status, d.created_at,
                    u.first_name, u.last_name, c.name as category_name, c.color
             FROM documents d
             LEFT JOIN users u ON d.owner_id = u.id
             LEFT JOIN categories c ON d.category_id = c.id
             ${whereClause}
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM documents d ${whereClause}`,
            params
        );

        res.json({
            success: true,
            data: {
                results: documents.map(doc => ({
                    id: doc.id,
                    uuid: doc.uuid,
                    title: doc.title,
                    description: doc.description,
                    fileName: doc.file_name,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    status: doc.status,
                    owner: `${doc.first_name} ${doc.last_name}`,
                    category: doc.category_name,
                    categoryColor: doc.color,
                    createdAt: doc.created_at
                })),
                query: q,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    totalPages: Math.ceil(countResult[0].total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Erreur recherche:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche'
        });
    }
};
