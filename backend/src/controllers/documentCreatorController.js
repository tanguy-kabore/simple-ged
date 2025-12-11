const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const ExcelJS = require('exceljs');
const PptxGenJS = require('pptxgenjs');
const libre = require('libreoffice-convert');
const mammoth = require('mammoth');
const { PDFDocument } = require('pdf-lib');
const PDFKit = require('pdfkit');
const pool = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { logActivity } = require('../utils/logger');

// Fonction pour créer un PDF à partir de texte
const createPDFFromText = (text) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFKit({
                size: 'A4',
                margin: 50
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            
            // Contenu seulement (pas de titre)
            doc.fontSize(12).font('Helvetica').text(text, {
                align: 'left',
                lineGap: 5
            });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Créer un document Word vierge (pour création initiale)
const createWordDocument = async (title, content = '', includeTitle = true) => {
    const children = [];
    
    // Ajouter le titre uniquement si demandé (création initiale)
    if (includeTitle && title) {
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: title,
                    bold: true,
                    size: 32,
                }),
            ],
            heading: HeadingLevel.HEADING_1,
        }));
    }
    
    // Ajouter le contenu - gérer les sauts de ligne
    const contentText = content || (includeTitle ? 'Commencez à écrire ici...' : '');
    const lines = contentText.split('\n');
    
    lines.forEach(line => {
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: line,
                    size: 24,
                }),
            ],
        }));
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    return await Packer.toBuffer(doc);
};

// Créer un document Excel vierge
const createExcelDocument = async (title) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GED Application';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet(title || 'Feuille 1');
    
    // Ajouter quelques colonnes par défaut
    worksheet.columns = [
        { header: 'Colonne A', key: 'colA', width: 15 },
        { header: 'Colonne B', key: 'colB', width: 15 },
        { header: 'Colonne C', key: 'colC', width: 15 },
        { header: 'Colonne D', key: 'colD', width: 15 },
    ];

    return await workbook.xlsx.writeBuffer();
};

// Créer une présentation PowerPoint vierge
const createPowerPointDocument = async (title) => {
    const pptx = new PptxGenJS();
    pptx.author = 'GED Application';
    pptx.title = title;
    
    // Slide de titre
    const slide = pptx.addSlide();
    slide.addText(title || 'Nouvelle Présentation', {
        x: 1,
        y: 2,
        w: '80%',
        h: 1.5,
        fontSize: 36,
        bold: true,
        color: '363636',
        align: 'center',
    });
    
    slide.addText('Créé avec GED Application', {
        x: 1,
        y: 4,
        w: '80%',
        h: 0.5,
        fontSize: 18,
        color: '666666',
        align: 'center',
    });

    return await pptx.write({ outputType: 'nodebuffer' });
};

// Créer un nouveau document
exports.createDocument = async (req, res) => {
    try {
        const { title, type, categoryId, folderId, description } = req.body;

        if (!title || !type) {
            return res.status(400).json({
                success: false,
                message: 'Le titre et le type sont requis'
            });
        }

        const validTypes = ['docx', 'xlsx', 'pptx'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type de document invalide. Types supportés: docx, xlsx, pptx'
            });
        }

        let buffer;
        let mimeType;
        const fileName = `${title}.${type}`;

        switch (type) {
            case 'docx':
                buffer = await createWordDocument(title);
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
            case 'xlsx':
                buffer = await createExcelDocument(title);
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
            case 'pptx':
                buffer = await createPowerPointDocument(title);
                mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                break;
        }

        // Générer un nom de fichier unique
        const uniqueFileName = `${Date.now()}-${uuidv4()}.${type}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFileName);
        
        // S'assurer que le dossier uploads existe
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        
        // Sauvegarder le fichier
        await fs.writeFile(filePath, buffer);

        // Calculer le checksum
        const checksum = crypto.createHash('md5').update(buffer).digest('hex');

        // Créer l'entrée dans la base de données
        const docUuid = uuidv4();
        const [result] = await pool.query(
            `INSERT INTO documents 
             (uuid, title, description, file_name, file_path, file_size, file_type, mime_type, 
              category_id, folder_id, owner_id, status, checksum)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [docUuid, title, description || '', fileName, filePath, buffer.length, type, mimeType,
             categoryId || null, folderId || null, req.user.id, checksum]
        );

        // Créer la première version
        await pool.query(
            `INSERT INTO document_versions 
             (document_id, version_number, file_name, file_path, file_size, checksum, comment, created_by)
             VALUES (?, 1, ?, ?, ?, ?, 'Création du document', ?)`,
            [result.insertId, fileName, filePath, buffer.length, checksum, req.user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'create',
            entityType: 'document',
            entityId: result.insertId,
            entityName: title,
            details: { type, method: 'created_in_app' },
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Document créé avec succès',
            data: {
                id: result.insertId,
                uuid: docUuid,
                title,
                fileName,
                type,
                size: buffer.length
            }
        });
    } catch (error) {
        console.error('Erreur création document:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du document'
        });
    }
};

// Convertir un document
exports.convertDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { targetFormat } = req.body;

        const validFormats = ['pdf', 'docx', 'xlsx', 'pptx', 'html', 'txt'];
        if (!validFormats.includes(targetFormat)) {
            return res.status(400).json({
                success: false,
                message: `Format cible invalide. Formats supportés: ${validFormats.join(', ')}`
            });
        }

        // Récupérer le document
        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];
        
        // Lire le fichier source
        const sourceBuffer = await fs.readFile(doc.file_path);
        
        let convertedBuffer;
        let newMimeType;
        let newFileName = `${path.parse(doc.file_name).name}.${targetFormat}`;

        // Définir les types MIME
        const mimeTypes = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'html': 'text/html',
            'txt': 'text/plain'
        };

        // Conversions natives sans LibreOffice (DOCX/TXT)
        if (doc.file_type === 'docx' && targetFormat === 'html') {
            const result = await mammoth.convertToHtml({ buffer: sourceBuffer });
            convertedBuffer = Buffer.from(result.value, 'utf-8');
            newMimeType = 'text/html';
        } else if (doc.file_type === 'docx' && targetFormat === 'txt') {
            const result = await mammoth.extractRawText({ buffer: sourceBuffer });
            convertedBuffer = Buffer.from(result.value, 'utf-8');
            newMimeType = 'text/plain';
        } else if (doc.file_type === 'txt' && targetFormat === 'html') {
            // TXT vers HTML simple
            const textContent = sourceBuffer.toString('utf-8');
            const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head><body><pre>${textContent}</pre></body></html>`;
            convertedBuffer = Buffer.from(htmlContent, 'utf-8');
            newMimeType = 'text/html';
        } else if (doc.file_type === 'docx' && targetFormat === 'pdf') {
            // DOCX vers PDF en utilisant PDFKit
            const result = await mammoth.extractRawText({ buffer: sourceBuffer });
            const textContent = result.value;
            
            // Créer le PDF avec PDFKit
            convertedBuffer = await createPDFFromText(textContent);
            newMimeType = 'application/pdf';
        } else if (doc.file_type === 'txt' && targetFormat === 'pdf') {
            // TXT vers PDF
            const textContent = sourceBuffer.toString('utf-8');
            convertedBuffer = await createPDFFromText(textContent);
            newMimeType = 'application/pdf';
        } else {
            // Autres conversions nécessitant LibreOffice
            try {
                convertedBuffer = await new Promise((resolve, reject) => {
                    libre.convert(sourceBuffer, targetFormat, undefined, (err, done) => {
                        if (err) reject(err);
                        else resolve(done);
                    });
                });
                newMimeType = mimeTypes[targetFormat] || 'application/octet-stream';
            } catch (convError) {
                console.error('Erreur LibreOffice:', convError);
                
                // Proposer des alternatives disponibles
                const alternatives = [];
                if (doc.file_type === 'docx') {
                    alternatives.push('HTML', 'TXT');
                }
                
                const altMessage = alternatives.length > 0 
                    ? ` Formats alternatifs disponibles: ${alternatives.join(', ')}.`
                    : '';
                    
                return res.status(500).json({
                    success: false,
                    message: `Cette conversion nécessite LibreOffice (non installé).${altMessage}`
                });
            }
        }

        // Envoyer le fichier converti
        res.setHeader('Content-Type', newMimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
        res.send(convertedBuffer);

        await logActivity({
            userId: req.user.id,
            action: 'convert',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            details: { fromFormat: doc.file_type, toFormat: targetFormat },
            ip: req.ip
        });

    } catch (error) {
        console.error('Erreur conversion document:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la conversion du document'
        });
    }
};

// Obtenir le contenu d'un document pour l'édition
exports.getDocumentContent = async (req, res) => {
    try {
        const { id } = req.params;

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        // Vérifier le verrouillage
        if (doc.is_locked && doc.locked_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Document verrouillé par un autre utilisateur'
            });
        }

        const sourceBuffer = await fs.readFile(doc.file_path);
        let content = null;
        let editable = false;

        // Extraire le contenu selon le type
        if (doc.file_type === 'docx') {
            const result = await mammoth.convertToHtml({ buffer: sourceBuffer });
            content = result.value;
            editable = true;
        } else if (doc.file_type === 'txt') {
            content = sourceBuffer.toString('utf-8');
            editable = true;
        }

        res.json({
            success: true,
            data: {
                id: doc.id,
                uuid: doc.uuid,
                title: doc.title,
                type: doc.file_type,
                content,
                editable,
                isLocked: doc.is_locked,
                lockedBy: doc.locked_by
            }
        });

    } catch (error) {
        console.error('Erreur lecture contenu:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la lecture du contenu'
        });
    }
};

// Sauvegarder le contenu d'un document (pour l'édition simple)
exports.saveDocumentContent = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, comment } = req.body;

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE id = ? OR uuid = ?',
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];

        // Vérifier le verrouillage
        if (doc.is_locked && doc.locked_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Document verrouillé par un autre utilisateur'
            });
        }

        if (doc.file_type !== 'docx' && doc.file_type !== 'txt') {
            return res.status(400).json({
                success: false,
                message: 'Ce type de document ne peut pas être édité directement'
            });
        }

        let buffer;
        if (doc.file_type === 'docx') {
            // Créer un nouveau document Word avec le contenu
            // Nettoyer le contenu HTML si présent
            const textContent = content
                .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();
            // Ne pas inclure le titre car c'est une modification de contenu
            buffer = await createWordDocument(doc.title, textContent, false);
        } else {
            buffer = Buffer.from(content, 'utf-8');
        }

        // Obtenir le numéro de version suivant
        const [[{ maxVersion }]] = await pool.query(
            'SELECT MAX(version_number) as maxVersion FROM document_versions WHERE document_id = ?',
            [doc.id]
        );
        const newVersion = (maxVersion || 0) + 1;

        // Sauvegarder le nouveau fichier
        const uniqueFileName = `${Date.now()}-${uuidv4()}.${doc.file_type}`;
        const newFilePath = path.join(UPLOAD_DIR, uniqueFileName);
        await fs.writeFile(newFilePath, buffer);

        const checksum = crypto.createHash('md5').update(buffer).digest('hex');

        // Mettre à jour le document
        await pool.query(
            `UPDATE documents SET 
             file_path = ?, file_size = ?, checksum = ?, current_version = ?, updated_at = NOW()
             WHERE id = ?`,
            [newFilePath, buffer.length, checksum, newVersion, doc.id]
        );

        // Créer une nouvelle version
        await pool.query(
            `INSERT INTO document_versions 
             (document_id, version_number, file_name, file_path, file_size, checksum, comment, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [doc.id, newVersion, doc.file_name, newFilePath, buffer.length, checksum, 
             comment || 'Modification du contenu', req.user.id]
        );

        await logActivity({
            userId: req.user.id,
            action: 'edit',
            entityType: 'document',
            entityId: doc.id,
            entityName: doc.title,
            details: { version: newVersion },
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Document sauvegardé avec succès',
            data: {
                version: newVersion
            }
        });

    } catch (error) {
        console.error('Erreur sauvegarde contenu:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la sauvegarde du contenu'
        });
    }
};

// Sessions de collaboration active
const collaborationSessions = new Map();

// Rejoindre une session de collaboration
exports.joinCollaboration = async (req, res) => {
    try {
        const { id } = req.params;

        const [documents] = await pool.query(
            `SELECT d.*, u.first_name, u.last_name 
             FROM documents d 
             LEFT JOIN users u ON d.locked_by = u.id
             WHERE d.id = ? OR d.uuid = ?`,
            [id, id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document non trouvé'
            });
        }

        const doc = documents[0];
        const sessionId = `doc-${doc.id}`;

        // Créer ou récupérer la session
        if (!collaborationSessions.has(sessionId)) {
            collaborationSessions.set(sessionId, {
                documentId: doc.id,
                users: new Map(),
                createdAt: new Date()
            });
        }

        const session = collaborationSessions.get(sessionId);
        session.users.set(req.user.id, {
            id: req.user.id,
            name: `${req.user.first_name} ${req.user.last_name}`,
            joinedAt: new Date()
        });

        res.json({
            success: true,
            data: {
                sessionId,
                documentId: doc.id,
                documentTitle: doc.title,
                activeUsers: Array.from(session.users.values()),
                isLocked: doc.is_locked,
                lockedBy: doc.locked_by ? {
                    id: doc.locked_by,
                    name: `${doc.first_name} ${doc.last_name}`
                } : null
            }
        });

    } catch (error) {
        console.error('Erreur collaboration:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion à la session'
        });
    }
};

// Quitter une session de collaboration
exports.leaveCollaboration = async (req, res) => {
    try {
        const { id } = req.params;
        const sessionId = `doc-${id}`;

        if (collaborationSessions.has(sessionId)) {
            const session = collaborationSessions.get(sessionId);
            session.users.delete(req.user.id);

            // Supprimer la session si vide
            if (session.users.size === 0) {
                collaborationSessions.delete(sessionId);
            }
        }

        res.json({
            success: true,
            message: 'Session quittée'
        });

    } catch (error) {
        console.error('Erreur déconnexion collaboration:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la déconnexion'
        });
    }
};

// Obtenir les utilisateurs actifs sur un document
exports.getCollaborators = async (req, res) => {
    try {
        const { id } = req.params;
        const sessionId = `doc-${id}`;

        const session = collaborationSessions.get(sessionId);
        const users = session ? Array.from(session.users.values()) : [];

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('Erreur récupération collaborateurs:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des collaborateurs'
        });
    }
};
