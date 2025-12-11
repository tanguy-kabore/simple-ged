const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { authenticate, checkPermission } = require('../middleware/auth');

router.use(authenticate);

// CRUD Dossiers
router.get('/', folderController.getFolders);
router.post('/', checkPermission('folders', 'create'), folderController.createFolder);
router.get('/:id', folderController.getFolder);
router.put('/:id', checkPermission('folders', 'update'), folderController.updateFolder);
router.delete('/:id', checkPermission('folders', 'delete'), folderController.deleteFolder);

// Actions
router.post('/:id/move', checkPermission('folders', 'update'), folderController.moveFolder);

module.exports = router;
