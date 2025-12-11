const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { authenticate } = require('../middleware/auth');

// Accès public via token
router.get('/access/:token', shareController.accessShare);
router.post('/access/:token', shareController.accessShare);

// Routes protégées
router.use(authenticate);

router.post('/link', shareController.createShareLink);
router.post('/user', shareController.shareWithUser);
router.get('/document/:documentId', shareController.getDocumentShares);
router.delete('/:shareId', shareController.revokeShare);

module.exports = router;
