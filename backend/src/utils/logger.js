const pool = require('../config/database');

/**
 * Logger d'activité pour la traçabilité
 */
const logActivity = async ({
    userId,
    action,
    entityType,
    entityId = null,
    entityName = null,
    details = null,
    ip = null,
    userAgent = null
}) => {
    try {
        await pool.query(
            `INSERT INTO activity_logs 
             (user_id, action, entity_type, entity_id, entity_name, details, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                action,
                entityType,
                entityId,
                entityName,
                details ? JSON.stringify(details) : null,
                ip,
                userAgent
            ]
        );
    } catch (error) {
        console.error('Erreur logging activité:', error);
        // Ne pas faire échouer l'opération principale si le log échoue
    }
};

module.exports = { logActivity };
