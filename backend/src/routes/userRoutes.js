const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Rôles et départements (accessibles à tous)
router.get('/roles', userController.getRoles);
router.get('/departments', userController.getDepartments);

// CRUD Utilisateurs (admin et manager)
router.get('/', authorize('admin', 'manager'), userController.getUsers);
router.post('/', authorize('admin'), [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty(),
    body('lastName').notEmpty()
], userController.createUser);

router.get('/:id', authorize('admin', 'manager'), userController.getUser);
router.put('/:id', authorize('admin'), userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

// Actions admin
router.post('/:id/reset-password', authorize('admin'), userController.resetPassword);

module.exports = router;
