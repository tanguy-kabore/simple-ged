const pool = require('../config/database');
const { logActivity } = require('../utils/logger');

// Obtenir toutes les catégories
exports.getCategories = async (req, res) => {
    try {
        // Récupérer le nombre total de documents archivés
        const [[{ archivedCount }]] = await pool.query(
            'SELECT COUNT(*) as archivedCount FROM documents WHERE is_archived = TRUE'
        );

        const [categories] = await pool.query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM documents WHERE category_id = c.id AND is_archived = FALSE) as document_count,
                    (SELECT COUNT(*) FROM folders WHERE category_id = c.id) as folder_count,
                    u.first_name, u.last_name
             FROM categories c
             LEFT JOIN users u ON c.created_by = u.id
             ORDER BY c.name ASC`
        );

        // Construire l'arborescence si parentId existe
        const buildTree = (items, parentId = null) => {
            return items
                .filter(item => item.parent_id === parentId)
                .map(item => {
                    // Si c'est la catégorie "Archives", afficher le nombre de documents archivés
                    const isArchiveCategory = item.name.toLowerCase().includes('archive');
                    return {
                        id: item.id,
                        name: item.name,
                        description: item.description,
                        color: item.color,
                        icon: item.icon,
                        documentCount: isArchiveCategory ? archivedCount : item.document_count,
                        folderCount: item.folder_count,
                        createdBy: item.first_name ? `${item.first_name} ${item.last_name}` : null,
                        children: buildTree(items, item.id),
                        createdAt: item.created_at
                    };
                });
        };

        res.json({
            success: true,
            data: buildTree(categories)
        });
    } catch (error) {
        console.error('Erreur récupération catégories:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des catégories'
        });
    }
};

// Créer une catégorie
exports.createCategory = async (req, res) => {
    try {
        const { name, description, parentId, color, icon } = req.body;

        const [result] = await pool.query(
            `INSERT INTO categories (name, description, parent_id, color, icon, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, description, parentId || null, color || '#3B82F6', icon || 'folder', req.user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'create',
            entityType: 'category',
            entityId: result.insertId,
            entityName: name,
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Catégorie créée avec succès',
            data: { id: result.insertId, name }
        });
    } catch (error) {
        console.error('Erreur création catégorie:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la catégorie'
        });
    }
};

// Mettre à jour une catégorie
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color, icon } = req.body;

        await pool.query(
            `UPDATE categories SET 
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             color = COALESCE(?, color),
             icon = COALESCE(?, icon)
             WHERE id = ?`,
            [name, description, color, icon, id]
        );

        res.json({
            success: true,
            message: 'Catégorie mise à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour catégorie:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de la catégorie'
        });
    }
};

// Supprimer une catégorie
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier s'il y a des documents/dossiers
        const [docs] = await pool.query('SELECT COUNT(*) as count FROM documents WHERE category_id = ?', [id]);
        const [folders] = await pool.query('SELECT COUNT(*) as count FROM folders WHERE category_id = ?', [id]);

        if (docs[0].count > 0 || folders[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer: catégorie utilisée',
                data: { documentCount: docs[0].count, folderCount: folders[0].count }
            });
        }

        await pool.query('DELETE FROM categories WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Catégorie supprimée avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression catégorie:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la catégorie'
        });
    }
};

// Obtenir les tags
exports.getTags = async (req, res) => {
    try {
        const [tags] = await pool.query(
            `SELECT t.*, COUNT(dt.document_id) as usage_count
             FROM tags t
             LEFT JOIN document_tags dt ON t.id = dt.tag_id
             GROUP BY t.id
             ORDER BY usage_count DESC, t.name ASC`
        );

        res.json({
            success: true,
            data: tags
        });
    } catch (error) {
        console.error('Erreur récupération tags:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des tags'
        });
    }
};

// Créer un tag
exports.createTag = async (req, res) => {
    try {
        const { name, color } = req.body;

        const [result] = await pool.query(
            'INSERT INTO tags (name, color) VALUES (?, ?)',
            [name, color || '#6B7280']
        );

        res.status(201).json({
            success: true,
            message: 'Tag créé avec succès',
            data: { id: result.insertId, name, color: color || '#6B7280' }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Ce tag existe déjà'
            });
        }
        console.error('Erreur création tag:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du tag'
        });
    }
};

// Supprimer un tag
exports.deleteTag = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM tags WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Tag supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression tag:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du tag'
        });
    }
};
