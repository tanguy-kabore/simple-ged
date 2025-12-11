const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { logActivity } = require('../utils/logger');
const { createNotification } = require('../utils/notifications');

// Créer un workflow (template)
exports.createWorkflow = async (req, res) => {
    try {
        const { name, description, categoryId, steps } = req.body;

        // Valider les étapes
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Au moins une étape de workflow est requise'
            });
        }

        const uuid = uuidv4();
        const [result] = await pool.query(
            `INSERT INTO workflows (uuid, name, description, category_id, steps, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuid, name, description, categoryId || null, JSON.stringify(steps), req.user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'create',
            entityType: 'workflow',
            entityId: result.insertId,
            entityName: name,
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Workflow créé avec succès',
            data: { id: result.insertId, uuid, name }
        });
    } catch (error) {
        console.error('Erreur création workflow:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du workflow'
        });
    }
};

// Obtenir tous les workflows
exports.getWorkflows = async (req, res) => {
    try {
        const { categoryId, active } = req.query;

        let query = `
            SELECT w.*, u.first_name, u.last_name, c.name as category_name,
                   (SELECT COUNT(*) FROM workflow_instances WHERE workflow_id = w.id) as usage_count
            FROM workflows w
            LEFT JOIN users u ON w.created_by = u.id
            LEFT JOIN categories c ON w.category_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (categoryId) {
            query += ' AND w.category_id = ?';
            params.push(categoryId);
        }

        if (active !== undefined) {
            query += ' AND w.is_active = ?';
            params.push(active === 'true');
        }

        query += ' ORDER BY w.name ASC';

        const [workflows] = await pool.query(query, params);

        res.json({
            success: true,
            data: workflows.map(w => ({
                id: w.id,
                uuid: w.uuid,
                name: w.name,
                description: w.description,
                category: w.category_id ? { id: w.category_id, name: w.category_name } : null,
                steps: typeof w.steps === 'string' ? JSON.parse(w.steps || '[]') : (w.steps || []),
                isActive: w.is_active,
                usageCount: w.usage_count,
                createdBy: `${w.first_name} ${w.last_name}`,
                createdAt: w.created_at
            }))
        });
    } catch (error) {
        console.error('Erreur récupération workflows:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des workflows'
        });
    }
};

// Obtenir un workflow
exports.getWorkflow = async (req, res) => {
    try {
        const { id } = req.params;

        const [workflows] = await pool.query(
            `SELECT w.*, u.first_name, u.last_name, c.name as category_name
             FROM workflows w
             LEFT JOIN users u ON w.created_by = u.id
             LEFT JOIN categories c ON w.category_id = c.id
             WHERE w.id = ? OR w.uuid = ?`,
            [id, id]
        );

        if (workflows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Workflow non trouvé'
            });
        }

        const workflow = workflows[0];

        res.json({
            success: true,
            data: {
                id: workflow.id,
                uuid: workflow.uuid,
                name: workflow.name,
                description: workflow.description,
                category: workflow.category_id ? { id: workflow.category_id, name: workflow.category_name } : null,
                steps: typeof workflow.steps === 'string' ? JSON.parse(workflow.steps || '[]') : (workflow.steps || []),
                isActive: workflow.is_active,
                createdBy: `${workflow.first_name} ${workflow.last_name}`,
                createdAt: workflow.created_at
            }
        });
    } catch (error) {
        console.error('Erreur récupération workflow:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du workflow'
        });
    }
};

// Démarrer une instance de workflow sur un document
exports.startWorkflow = async (req, res) => {
    try {
        const { workflowId, documentId } = req.body;

        // Vérifier le workflow
        const [workflows] = await pool.query(
            'SELECT * FROM workflows WHERE (id = ? OR uuid = ?) AND is_active = TRUE',
            [workflowId, workflowId]
        );

        if (workflows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Workflow non trouvé ou inactif'
            });
        }

        const workflow = workflows[0];
        const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps || '[]') : (workflow.steps || []);

        // Vérifier le document
        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [documentId, documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const document = documents[0];

        // Vérifier qu'il n'y a pas déjà un workflow en cours
        const [existing] = await pool.query(
            `SELECT id FROM workflow_instances 
             WHERE document_id = ? AND status IN ('pending', 'in_progress')`,
            [document.id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Un workflow est déjà en cours pour ce document'
            });
        }

        // Créer l'instance de workflow
        const uuid = uuidv4();
        const [result] = await pool.query(
            `INSERT INTO workflow_instances (uuid, workflow_id, document_id, status, started_by)
             VALUES (?, ?, ?, 'in_progress', ?)`,
            [uuid, workflow.id, document.id, req.user.id]
        );

        // Créer la première étape
        if (steps.length > 0) {
            const firstStep = steps[0];
            await pool.query(
                `INSERT INTO workflow_steps (instance_id, step_number, step_name, action, assigned_to)
                 VALUES (?, 1, ?, 'approve', ?)`,
                [result.insertId, firstStep.name, firstStep.assigneeId]
            );

            // Notifier l'assigné
            await createNotification({
                userId: firstStep.assigneeId,
                type: 'workflow_task',
                title: 'Nouvelle tâche de validation',
                message: `Vous avez une nouvelle tâche de validation pour le document "${document.title}"`,
                link: `/documents/${document.uuid}`
            });
        }

        // Mettre à jour le statut du document
        await pool.query(
            'UPDATE documents SET status = "pending" WHERE id = ?',
            [document.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'workflow_start',
            entityType: 'workflow',
            entityId: result.insertId,
            entityName: workflow.name,
            details: { documentId: document.id, documentTitle: document.title },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Workflow démarré avec succès',
            data: { instanceId: result.insertId, uuid }
        });
    } catch (error) {
        console.error('Erreur démarrage workflow:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage du workflow'
        });
    }
};

// Traiter une étape de workflow
exports.processStep = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { action, comment } = req.body; // action: 'approve' ou 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action invalide. Utilisez "approve" ou "reject"'
            });
        }

        // Récupérer l'instance
        const [instances] = await pool.query(
            `SELECT wi.*, w.steps, w.name as workflow_name, d.title as document_title, d.id as doc_id
             FROM workflow_instances wi
             JOIN workflows w ON wi.workflow_id = w.id
             JOIN documents d ON wi.document_id = d.id
             WHERE wi.id = ? OR wi.uuid = ?`,
            [instanceId, instanceId]
        );

        if (instances.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Instance de workflow non trouvée'
            });
        }

        const instance = instances[0];
        const steps = typeof instance.steps === 'string' ? JSON.parse(instance.steps || '[]') : (instance.steps || []);

        if (instance.status !== 'in_progress') {
            return res.status(400).json({
                success: false,
                message: 'Ce workflow n\'est plus en cours'
            });
        }

        // Vérifier que l'utilisateur est assigné à l'étape actuelle
        const [currentSteps] = await pool.query(
            `SELECT * FROM workflow_steps 
             WHERE instance_id = ? AND step_number = ? AND completed_at IS NULL`,
            [instance.id, instance.current_step]
        );

        if (currentSteps.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucune étape en attente'
            });
        }

        const currentStep = currentSteps[0];

        if (currentStep.assigned_to !== req.user.id && req.user.role_name !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'êtes pas assigné à cette étape'
            });
        }

        // Compléter l'étape
        await pool.query(
            `UPDATE workflow_steps SET 
             action = ?, comment = ?, completed_by = ?, completed_at = NOW()
             WHERE id = ?`,
            [action, comment, req.user.id, currentStep.id]
        );

        if (action === 'reject') {
            // Workflow rejeté
            await pool.query(
                `UPDATE workflow_instances SET status = 'rejected', completed_at = NOW()
                 WHERE id = ?`,
                [instance.id]
            );

            await pool.query(
                'UPDATE documents SET status = "rejected" WHERE id = ?',
                [instance.doc_id]
            );

            // Notifier le créateur
            await createNotification({
                userId: instance.started_by,
                type: 'workflow_rejected',
                title: 'Document rejeté',
                message: `Le document "${instance.document_title}" a été rejeté`,
                link: `/documents/${instance.document_id}`
            });
        } else {
            // Vérifier s'il y a une étape suivante
            if (instance.current_step < steps.length) {
                // Passer à l'étape suivante
                const nextStep = steps[instance.current_step];
                
                await pool.query(
                    'UPDATE workflow_instances SET current_step = ? WHERE id = ?',
                    [instance.current_step + 1, instance.id]
                );

                await pool.query(
                    `INSERT INTO workflow_steps (instance_id, step_number, step_name, action, assigned_to)
                     VALUES (?, ?, ?, 'approve', ?)`,
                    [instance.id, instance.current_step + 1, nextStep.name, nextStep.assigneeId]
                );

                // Notifier le prochain assigné
                await createNotification({
                    userId: nextStep.assigneeId,
                    type: 'workflow_task',
                    title: 'Nouvelle tâche de validation',
                    message: `Vous avez une nouvelle tâche de validation pour le document "${instance.document_title}"`,
                    link: `/documents/${instance.document_id}`
                });
            } else {
                // Workflow complété
                await pool.query(
                    `UPDATE workflow_instances SET status = 'approved', completed_at = NOW()
                     WHERE id = ?`,
                    [instance.id]
                );

                await pool.query(
                    'UPDATE documents SET status = "approved" WHERE id = ?',
                    [instance.doc_id]
                );

                // Notifier le créateur
                await createNotification({
                    userId: instance.started_by,
                    type: 'workflow_completed',
                    title: 'Document approuvé',
                    message: `Le document "${instance.document_title}" a été approuvé`,
                    link: `/documents/${instance.document_id}`
                });
            }
        }

        await logActivity({
            userId: req.user.id,
            action: `workflow_${action}`,
            entityType: 'workflow',
            entityId: instance.id,
            entityName: instance.workflow_name,
            details: { step: instance.current_step, comment },
            ip: req.ip
        });

        res.json({
            success: true,
            message: `Étape ${action === 'approve' ? 'approuvée' : 'rejetée'} avec succès`
        });
    } catch (error) {
        console.error('Erreur traitement étape:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du traitement de l\'étape'
        });
    }
};

// Obtenir les tâches en attente pour l'utilisateur connecté
exports.getMyTasks = async (req, res) => {
    try {
        const [tasks] = await pool.query(
            `SELECT ws.*, wi.uuid as instance_uuid, wi.status as instance_status,
                    w.name as workflow_name, d.id as document_id, d.uuid as document_uuid,
                    d.title as document_title, d.file_type,
                    u.first_name as started_by_first, u.last_name as started_by_last
             FROM workflow_steps ws
             JOIN workflow_instances wi ON ws.instance_id = wi.id
             JOIN workflows w ON wi.workflow_id = w.id
             JOIN documents d ON wi.document_id = d.id
             JOIN users u ON wi.started_by = u.id
             WHERE ws.assigned_to = ? AND ws.completed_at IS NULL
             AND wi.status = 'in_progress'
             ORDER BY ws.created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: tasks.map(t => ({
                id: t.id,
                stepNumber: t.step_number,
                stepName: t.step_name,
                instanceId: t.instance_id,
                instanceUuid: t.instance_uuid,
                workflowName: t.workflow_name,
                document: {
                    id: t.document_id,
                    uuid: t.document_uuid,
                    title: t.document_title,
                    fileType: t.file_type
                },
                startedBy: `${t.started_by_first} ${t.started_by_last}`,
                createdAt: t.created_at
            }))
        });
    } catch (error) {
        console.error('Erreur récupération tâches:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des tâches'
        });
    }
};

// Obtenir l'historique d'une instance de workflow
exports.getWorkflowHistory = async (req, res) => {
    try {
        const { instanceId } = req.params;

        const [instances] = await pool.query(
            `SELECT wi.*, w.name as workflow_name, w.steps,
                    d.title as document_title, d.uuid as document_uuid,
                    u.first_name, u.last_name
             FROM workflow_instances wi
             JOIN workflows w ON wi.workflow_id = w.id
             JOIN documents d ON wi.document_id = d.id
             JOIN users u ON wi.started_by = u.id
             WHERE wi.id = ? OR wi.uuid = ?`,
            [instanceId, instanceId]
        );

        if (instances.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Instance non trouvée'
            });
        }

        const instance = instances[0];

        const [history] = await pool.query(
            `SELECT ws.*, 
                    ua.first_name as assigned_first, ua.last_name as assigned_last,
                    uc.first_name as completed_first, uc.last_name as completed_last
             FROM workflow_steps ws
             LEFT JOIN users ua ON ws.assigned_to = ua.id
             LEFT JOIN users uc ON ws.completed_by = uc.id
             WHERE ws.instance_id = ?
             ORDER BY ws.step_number ASC`,
            [instance.id]
        );

        res.json({
            success: true,
            data: {
                instance: {
                    id: instance.id,
                    uuid: instance.uuid,
                    workflowName: instance.workflow_name,
                    document: {
                        uuid: instance.document_uuid,
                        title: instance.document_title
                    },
                    currentStep: instance.current_step,
                    totalSteps: (typeof instance.steps === 'string' ? JSON.parse(instance.steps || '[]') : (instance.steps || [])).length,
                    status: instance.status,
                    startedBy: `${instance.first_name} ${instance.last_name}`,
                    startedAt: instance.started_at,
                    completedAt: instance.completed_at
                },
                history: history.map(h => ({
                    stepNumber: h.step_number,
                    stepName: h.step_name,
                    action: h.action,
                    comment: h.comment,
                    assignedTo: `${h.assigned_first} ${h.assigned_last}`,
                    completedBy: h.completed_by ? `${h.completed_first} ${h.completed_last}` : null,
                    completedAt: h.completed_at,
                    createdAt: h.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Erreur récupération historique:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'historique'
        });
    }
};

// Annuler un workflow
exports.cancelWorkflow = async (req, res) => {
    try {
        const { instanceId } = req.params;

        const [instances] = await pool.query(
            'SELECT * FROM workflow_instances WHERE id = ? OR uuid = ?',
            [instanceId, instanceId]
        );

        if (instances.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Instance non trouvée'
            });
        }

        const instance = instances[0];

        if (instance.status !== 'in_progress' && instance.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Ce workflow ne peut plus être annulé'
            });
        }

        // Vérifier les droits (créateur ou admin)
        if (instance.started_by !== req.user.id && req.user.role_name !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à annuler ce workflow'
            });
        }

        await pool.query(
            `UPDATE workflow_instances SET status = 'cancelled', completed_at = NOW()
             WHERE id = ?`,
            [instance.id]
        );

        await pool.query(
            'UPDATE documents SET status = "draft" WHERE id = ?',
            [instance.document_id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'workflow_cancel',
            entityType: 'workflow',
            entityId: instance.id,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Workflow annulé avec succès'
        });
    } catch (error) {
        console.error('Erreur annulation workflow:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'annulation du workflow'
        });
    }
};
