const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Catégories
router.get('/', categoryController.getCategories);
router.post('/', authorize('admin', 'manager'), categoryController.createCategory);
router.put('/:id', authorize('admin', 'manager'), categoryController.updateCategory);
router.delete('/:id', authorize('admin'), categoryController.deleteCategory);

// Tags
router.get('/tags', categoryController.getTags);
router.post('/tags', categoryController.createTag);
router.delete('/tags/:id', authorize('admin', 'manager'), categoryController.deleteTag);

module.exports = router;
