const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initializeDatabase() {
    console.log('🚀 Initialisation de la base de données GED...\n');

    // Connexion sans spécifier de base de données
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    try {
        // Lire le fichier SQL
        const schemaPath = path.join(__dirname, 'schema.sql');
        let schema = fs.readFileSync(schemaPath, 'utf8');

        // Hasher le mot de passe admin correctement
        const adminPassword = await bcrypt.hash('Admin@123', 10);
        schema = schema.replace(
            '$2a$10$rQnM1.E6eiHRHvRYJ5HXxuN5Ew5Ew5K5K5K5K5K5K5K5K5K5K5K5K',
            adminPassword
        );

        console.log('📄 Exécution du schéma SQL...');
        await connection.query(schema);

        console.log('✅ Base de données créée avec succès!');
        console.log('\n📋 Récapitulatif:');
        console.log('   - Base de données: ged_database');
        console.log('   - Tables créées: 18');
        console.log('   - Rôles: admin, manager, user, guest');
        console.log('   - Catégories: 8 catégories par défaut');
        console.log('\n👤 Compte administrateur:');
        console.log('   - Email: admin@ged.local');
        console.log('   - Mot de passe: Admin@123');
        console.log('\n⚠️  Changez le mot de passe admin après la première connexion!');

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
