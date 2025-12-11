const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { logActivity } = require('../utils/logger');

// Créer un dossier
exports.createFolder = async (req, res) => {
    try {
        const { name, description, parentId, categoryId } = req.body;

        // Calculer le chemin
        let path = `/${name}`;
        if (parentId) {
            const [parents] = await pool.query('SELECT path FROM folders WHERE id = ?', [parentId]);
            if (parents.length > 0) {
                path = `${parents[0].path}/${name}`;
            }
        }

        const uuid = uuidv4();
        const [result] = await pool.query(
            `INSERT INTO folders (uuid, name, description, parent_id, category_id, owner_id, path)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuid, name, description, parentId || null, categoryId || null, req.user.id, path]
        );

        await logActivity({
            userId: req.user.id,
            action: 'create',
            entityType: 'folder',
            entityId: result.insertId,
            entityName: name,
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Dossier créé avec succès',
            data: { id: result.insertId, uuid, name, path }
        });
    } catch (error) {
        console.error('Erreur création dossier:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du dossier'
        });
    }
};

// Obtenir tous les dossiers (arborescence)
exports.getFolders = async (req, res) => {
    try {
        const { parentId, flat } = req.query;

        let query = `
            SELECT f.*, u.first_name, u.last_name, c.name as category_name, c.color,
                   (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
                   (SELECT COUNT(*) FROM documents WHERE folder_id = f.id AND is_archived = FALSE) as document_count
            FROM folders f
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN categories c ON f.category_id = c.id
            WHERE f.is_archived = FALSE
        `;
        const params = [];

        if (parentId === 'null' || parentId === 'root') {
            query += ' AND f.parent_id IS NULL';
        } else if (parentId) {
            query += ' AND f.parent_id = ?';
            params.push(parentId);
        }

        query += ' ORDER BY f.name ASC';

        const [folders] = await pool.query(query, params);

        // Si flat=true, retourner une liste plate
        if (flat === 'true') {
            return res.json({
                success: true,
                data: folders.map(f => ({
                    id: f.id,
                    uuid: f.uuid,
                    name: f.name,
                    description: f.description,
                    path: f.path,
                    parentId: f.parent_id,
                    category: f.category_id ? { id: f.category_id, name: f.category_name, color: f.color } : null,
                    owner: { name: `${f.first_name} ${f.last_name}` },
                    subfolderCount: f.subfolder_count,
                    documentCount: f.document_count,
                    isShared: f.is_shared,
                    createdAt: f.created_at
                }))
            });
        }

        // Construire l'arborescence
        const buildTree = (items, parentId = null) => {
            return items
                .filter(item => item.parent_id === parentId)
                .map(item => ({
                    id: item.id,
                    uuid: item.uuid,
                    name: item.name,
                    description: item.description,
                    path: item.path,
                    category: item.category_id ? { id: item.category_id, name: item.category_name, color: item.color } : null,
                    owner: { name: `${item.first_name} ${item.last_name}` },
                    subfolderCount: item.subfolder_count,
                    documentCount: item.document_count,
                    isShared: item.is_shared,
                    children: buildTree(items, item.id),
                    createdAt: item.created_at
                }));
        };

        const [allFolders] = await pool.query(`
            SELECT f.*, u.first_name, u.last_name, c.name as category_name, c.color,
                   (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
                   (SELECT COUNT(*) FROM documents WHERE folder_id = f.id AND is_archived = FALSE) as document_count
            FROM folders f
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN categories c ON f.category_id = c.id
            WHERE f.is_archived = FALSE
            ORDER BY f.name ASC
        `);

        res.json({
            success: true,
            data: buildTree(allFolders)
        });
    } catch (error) {
        console.error('Erreur récupération dossiers:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des dossiers'
        });
    }
};

// Obtenir un dossier et son contenu
exports.getFolder = async (req, res) => {
    try {
        const { id } = req.params;

        const [folders] = await pool.query(
            `SELECT f.*, u.first_name, u.last_name, c.name as category_name, c.color
             FROM folders f
             LEFT JOIN users u ON f.owner_id = u.id
             LEFT JOIN categories c ON f.category_id = c.id
             WHERE f.id = ? OR f.uuid = ?`,
            [id, id]
        );

        if (folders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dossier non trouvé'
            });
        }

        const folder = folders[0];

        // Récupérer les sous-dossiers
        const [subfolders] = await pool.query(
            `SELECT id, uuid, name, 
                    (SELECT COUNT(*) FROM documents WHERE folder_id = folders.id) as document_count
             FROM folders WHERE parent_id = ? AND is_archived = FALSE
             ORDER BY name ASC`,
            [folder.id]
        );

        // Récupérer les documents
        const [documents] = await pool.query(
            `SELECT d.id, d.uuid, d.title, d.file_name, d.file_type, d.file_size, 
                    d.mime_type, d.status, d.created_at,
                    u.first_name, u.last_name
             FROM documents d
             JOIN users u ON d.owner_id = u.id
             WHERE d.folder_id = ? AND d.is_archived = FALSE
             ORDER BY d.title ASC`,
            [folder.id]
        );

        // Récupérer le chemin (breadcrumb)
        const getBreadcrumb = async (folderId) => {
            const breadcrumb = [];
            let currentId = folderId;

            while (currentId) {
                const [f] = await pool.query('SELECT id, uuid, name, parent_id FROM folders WHERE id = ?', [currentId]);
                if (f.length > 0) {
                    breadcrumb.unshift({ id: f[0].id, uuid: f[0].uuid, name: f[0].name });
                    currentId = f[0].parent_id;
                } else {
                    break;
                }
            }

            return breadcrumb;
        };

        const breadcrumb = await getBreadcrumb(folder.id);

        res.json({
            success: true,
            data: {
                folder: {
                    id: folder.id,
                    uuid: folder.uuid,
                    name: folder.name,
                    description: folder.description,
                    path: folder.path,
                    category: folder.category_id ? {
                        id: folder.category_id,
                        name: folder.category_name,
                        color: folder.color
                    } : null,
                    owner: { name: `${folder.first_name} ${folder.last_name}` },
                    isShared: folder.is_shared,
                    createdAt: folder.created_at
                },
                breadcrumb,
                subfolders: subfolders.map(sf => ({
                    id: sf.id,
                    uuid: sf.uuid,
                    name: sf.name,
                    documentCount: sf.document_count
                })),
                documents: documents.map(doc => ({
                    id: doc.id,
                    uuid: doc.uuid,
                    title: doc.title,
                    fileName: doc.file_name,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    mimeType: doc.mime_type,
                    status: doc.status,
                    owner: `${doc.first_name} ${doc.last_name}`,
                    createdAt: doc.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Erreur récupération dossier:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dossier'
        });
    }
};

// Mettre à jour un dossier
exports.updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, categoryId } = req.body;

        const [folders] = await pool.query('SELECT * FROM folders WHERE id = ? OR uuid = ?', [id, id]);

        if (folders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dossier non trouvé'
            });
        }

        const folder = folders[0];

        // Mettre à jour le chemin si le nom change
        let newPath = folder.path;
        if (name && name !== folder.name) {
            newPath = folder.path.replace(new RegExp(`/${folder.name}$`), `/${name}`);
        }

        await pool.query(
            `UPDATE folders SET 
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             category_id = COALESCE(?, category_id),
             path = ?
             WHERE id = ?`,
            [name, description, categoryId, newPath, folder.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'update',
            entityType: 'folder',
            entityId: folder.id,
            entityName: name || folder.name,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Dossier mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour dossier:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du dossier'
        });
    }
};

// Supprimer un dossier
exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { recursive } = req.query;

        const [folders] = await pool.query('SELECT * FROM folders WHERE id = ? OR uuid = ?', [id, id]);

        if (folders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dossier non trouvé'
            });
        }

        const folder = folders[0];

        // Vérifier s'il y a du contenu
        const [subfolders] = await pool.query('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?', [folder.id]);
        const [documents] = await pool.query('SELECT COUNT(*) as count FROM documents WHERE folder_id = ?', [folder.id]);

        if ((subfolders[0].count > 0 || documents[0].count > 0) && recursive !== 'true') {
            return res.status(400).json({
                success: false,
                message: 'Le dossier contient des éléments. Utilisez recursive=true pour supprimer tout.',
                data: {
                    subfolderCount: subfolders[0].count,
                    documentCount: documents[0].count
                }
            });
        }

        // Supprimer récursivement si demandé
        if (recursive === 'true') {
            // Les clés étrangères CASCADE s'occupent de la suppression en cascade
        }

        await pool.query('DELETE FROM folders WHERE id = ?', [folder.id]);

        await logActivity({
            userId: req.user.id,
            action: 'delete',
            entityType: 'folder',
            entityId: folder.id,
            entityName: folder.name,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Dossier supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression dossier:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du dossier'
        });
    }
};

// Déplacer un dossier
exports.moveFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { targetFolderId } = req.body;

        const [folders] = await pool.query('SELECT * FROM folders WHERE id = ? OR uuid = ?', [id, id]);

        if (folders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dossier non trouvé'
            });
        }

        const folder = folders[0];

        // Calculer le nouveau chemin
        let newPath = `/${folder.name}`;
        if (targetFolderId) {
            const [targets] = await pool.query('SELECT path FROM folders WHERE id = ?', [targetFolderId]);
            if (targets.length > 0) {
                newPath = `${targets[0].path}/${folder.name}`;
            }
        }

        await pool.query(
            'UPDATE folders SET parent_id = ?, path = ? WHERE id = ?',
            [targetFolderId || null, newPath, folder.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'move',
            entityType: 'folder',
            entityId: folder.id,
            entityName: folder.name,
            details: { targetFolderId },
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Dossier déplacé avec succès'
        });
    } catch (error) {
        console.error('Erreur déplacement dossier:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du déplacement du dossier'
        });
    }
};
