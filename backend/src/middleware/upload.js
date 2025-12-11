const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Créer le dossier uploads s'il n'existe pas
const uploadDir = process.env.UPLOAD_PATH || './uploads';
const versionsDir = path.join(uploadDir, 'versions');

[uploadDir, versionsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configuration du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Organiser par année/mois
        const date = new Date();
        const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        const destPath = path.join(uploadDir, yearMonth);
        
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }
        
        cb(null, destPath);
    },
    filename: (req, file, cb) => {
        // Générer un nom unique
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        const safeName = `${uniqueId}${ext}`;
        cb(null, safeName);
    }
});

// Filtre des fichiers
const fileFilter = (req, file, cb) => {
    const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || 
        'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,zip,rar').split(',');
    
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Extension .${ext} non autorisée. Extensions acceptées: ${allowedExtensions.join(', ')}`), false);
    }
};

// Configuration Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800, // 50 Mo par défaut
        files: 10 // Maximum 10 fichiers à la fois
    }
});

// Middleware pour les versions
const versionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, versionsDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueId}${ext}`);
    }
});

const uploadVersion = multer({
    storage: versionStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800
    }
});

// Gestionnaire d'erreurs Multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Fichier trop volumineux. Taille maximale: 50 Mo'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Trop de fichiers. Maximum: 10 fichiers'
            });
        }
        return res.status(400).json({
            success: false,
            message: `Erreur d'upload: ${err.message}`
        });
    }
    
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    next();
};

module.exports = { upload, uploadVersion, handleUploadError };
