const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Dashboard
router.get('/dashboard', statsController.getDashboard);

// Stats de stockage (admin/manager)
router.get('/storage', authorize('admin', 'manager'), statsController.getStorageStats);

// Logs d'activité (admin)
router.get('/activity', authorize('admin'), statsController.getActivityLogs);

// Notifications
router.get('/notifications', statsController.getNotifications);
router.put('/notifications/read', statsController.markNotificationsRead);

// Favoris
router.get('/favorites', statsController.getFavorites);
router.post('/favorites', statsController.addFavorite);
router.delete('/favorites/:id', statsController.removeFavorite);

module.exports = router;
