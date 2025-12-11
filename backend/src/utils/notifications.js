const pool = require('../config/database');

/**
 * Créer une notification pour un utilisateur
 */
const createNotification = async ({
    userId,
    type,
    title,
    message,
    link = null
}) => {
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, type, title, message, link]
        );
    } catch (error) {
        console.error('Erreur création notification:', error);
    }
};

/**
 * Notifier plusieurs utilisateurs
 */
const notifyUsers = async (userIds, notification) => {
    try {
        const values = userIds.map(userId => [
            userId,
            notification.type,
            notification.title,
            notification.message,
            notification.link || null
        ]);

        if (values.length > 0) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ?`,
                [values]
            );
        }
    } catch (error) {
        console.error('Erreur notification multiple:', error);
    }
};

/**
 * Notifier tous les utilisateurs d'un rôle
 */
const notifyRole = async (roleName, notification) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE r.name = ? AND u.is_active = TRUE`,
            [roleName]
        );

        const userIds = users.map(u => u.id);
        await notifyUsers(userIds, notification);
    } catch (error) {
        console.error('Erreur notification rôle:', error);
    }
};

module.exports = { createNotification, notifyUsers, notifyRole };
