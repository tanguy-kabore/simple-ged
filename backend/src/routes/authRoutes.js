const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Validation
const loginValidation = [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis')
];

const registerValidation = [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
    body('firstName').notEmpty().withMessage('Prénom requis'),
    body('lastName').notEmpty().withMessage('Nom requis')
];

// Routes publiques
router.post('/login', loginValidation, authController.login);
router.post('/register', registerValidation, authController.register);

// Routes protégées
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
