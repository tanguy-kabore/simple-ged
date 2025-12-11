const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate, authorize, checkPermission } = require('../middleware/auth');
const { upload, uploadVersion, handleUploadError } = require('../middleware/upload');

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Upload de documents
router.post('/upload', 
    checkPermission('documents', 'create'),
    upload.single('file'), 
    handleUploadError, 
    documentController.uploadDocument
);

router.post('/upload-multiple', 
    checkPermission('documents', 'create'),
    upload.array('files', 10), 
    handleUploadError, 
    documentController.uploadMultiple
);

// CRUD Documents
router.get('/', documentController.getDocuments);
router.get('/search', documentController.searchDocuments);
router.get('/:id', documentController.getDocument);
router.put('/:id', checkPermission('documents', 'update'), documentController.updateDocument);
router.delete('/:id', checkPermission('documents', 'delete'), documentController.deleteDocument);

// Téléchargement
router.get('/:id/download', documentController.downloadDocument);

// Versions
router.post('/:id/versions', 
    checkPermission('documents', 'update'),
    uploadVersion.single('file'), 
    handleUploadError, 
    documentController.createVersion
);

// Actions
router.post('/:id/lock', checkPermission('documents', 'update'), documentController.toggleLock);
router.post('/:id/archive', checkPermission('documents', 'update'), documentController.archiveDocument);

// Commentaires
router.post('/:id/comments', documentController.addComment);

module.exports = router;
