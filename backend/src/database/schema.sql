-- ============================================
-- GED - Gestion Électronique des Documents
-- Schéma de base de données MySQL
-- ============================================

CREATE DATABASE IF NOT EXISTS ged_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ged_database;

-- ============================================
-- Table des rôles
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- Table des utilisateurs
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar VARCHAR(255),
    role_id INT NOT NULL,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================
-- Table des catégories de documents
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'folder',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- Table des dossiers
-- ============================================
CREATE TABLE IF NOT EXISTS folders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INT NULL,
    category_id INT,
    owner_id INT NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    path VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- ============================================
-- Table des documents
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    folder_id INT,
    category_id INT,
    owner_id INT NOT NULL,
    current_version INT DEFAULT 1,
    status ENUM('draft', 'pending', 'approved', 'rejected', 'archived') DEFAULT 'draft',
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by INT NULL,
    locked_at TIMESTAMP NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP NULL,
    retention_date DATE NULL,
    tags JSON,
    metadata JSON,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (locked_by) REFERENCES users(id)
);

-- ============================================
-- Table des versions de documents
-- ============================================
CREATE TABLE IF NOT EXISTS document_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id INT NOT NULL,
    version_number INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64),
    comment TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY unique_version (document_id, version_number)
);

-- ============================================
-- Table des permissions sur les documents
-- ============================================
CREATE TABLE IF NOT EXISTS document_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id INT NOT NULL,
    user_id INT NULL,
    role_id INT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_share BOOLEAN DEFAULT FALSE,
    can_download BOOLEAN DEFAULT TRUE,
    granted_by INT NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- ============================================
-- Table des permissions sur les dossiers
-- ============================================
CREATE TABLE IF NOT EXISTS folder_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    folder_id INT NOT NULL,
    user_id INT NULL,
    role_id INT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_share BOOLEAN DEFAULT FALSE,
    can_upload BOOLEAN DEFAULT FALSE,
    granted_by INT NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- ============================================
-- Table des workflows
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INT,
    steps JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- Table des instances de workflow
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_instances (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    workflow_id INT NOT NULL,
    document_id INT NOT NULL,
    current_step INT DEFAULT 1,
    status ENUM('pending', 'in_progress', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    started_by INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (started_by) REFERENCES users(id)
);

-- ============================================
-- Table des étapes de workflow (historique)
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_steps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instance_id INT NOT NULL,
    step_number INT NOT NULL,
    step_name VARCHAR(100),
    action ENUM('approve', 'reject', 'comment', 'reassign') NOT NULL,
    comment TEXT,
    assigned_to INT NOT NULL,
    completed_by INT,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (completed_by) REFERENCES users(id)
);

-- ============================================
-- Table des commentaires sur les documents
-- ============================================
CREATE TABLE IF NOT EXISTS document_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_id INT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES document_comments(id) ON DELETE CASCADE
);

-- ============================================
-- Table des favoris
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    document_id INT NULL,
    folder_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- ============================================
-- Table des partages (liens de partage)
-- ============================================
CREATE TABLE IF NOT EXISTS shares (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    document_id INT NULL,
    folder_id INT NULL,
    shared_by INT NOT NULL,
    share_type ENUM('link', 'user', 'email') NOT NULL,
    share_token VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    can_download BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    access_count INT DEFAULT 0,
    max_access INT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id)
);

-- ============================================
-- Table des logs d'activité (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    entity_type ENUM('document', 'folder', 'user', 'workflow', 'share', 'system') NOT NULL,
    entity_id INT,
    entity_name VARCHAR(255),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- Table des notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- Table des tags
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table de liaison documents-tags
-- ============================================
CREATE TABLE IF NOT EXISTS document_tags (
    document_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ============================================
-- Table des paramètres système
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- Index pour optimisation des recherches
-- ============================================
CREATE INDEX idx_documents_title ON documents(title);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_created ON documents(created_at);
CREATE INDEX idx_folders_owner ON folders(owner_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ============================================
-- Recherche Full-Text sur les documents
-- ============================================
ALTER TABLE documents ADD FULLTEXT INDEX ft_documents_search (title, description);

-- ============================================
-- Insertion des rôles par défaut
-- ============================================
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Administrateur système avec tous les droits', '{"all": true}'),
('manager', 'Gestionnaire avec droits de validation et gestion d''équipe', '{"documents": {"create": true, "read": true, "update": true, "delete": true, "approve": true}, "folders": {"create": true, "read": true, "update": true, "delete": true}, "users": {"read": true}, "workflows": {"create": true, "manage": true}, "reports": true}'),
('user', 'Utilisateur standard avec droits de base', '{"documents": {"create": true, "read": true, "update": true, "delete": false}, "folders": {"create": true, "read": true, "update": true, "delete": false}, "workflows": {"participate": true}}'),
('guest', 'Invité avec accès en lecture seule', '{"documents": {"read": true}, "folders": {"read": true}}');

-- ============================================
-- Insertion des catégories par défaut
-- ============================================
INSERT INTO categories (name, description, color, icon) VALUES
('Contrats', 'Documents contractuels et juridiques', '#EF4444', 'file-text'),
('Factures', 'Factures clients et fournisseurs', '#10B981', 'receipt'),
('Ressources Humaines', 'Documents RH et employés', '#8B5CF6', 'users'),
('Comptabilité', 'Documents comptables et financiers', '#F59E0B', 'calculator'),
('Projets', 'Documentation de projets', '#3B82F6', 'briefcase'),
('Communication', 'Documents de communication interne et externe', '#EC4899', 'mail'),
('Technique', 'Documentation technique', '#6366F1', 'settings'),
('Archives', 'Documents archivés', '#6B7280', 'archive');

-- ============================================
-- Insertion des paramètres par défaut
-- ============================================
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', 'Mon Entreprise', 'string', 'Nom de l''entreprise'),
('max_file_size', '52428800', 'number', 'Taille maximale des fichiers en octets (50 Mo)'),
('allowed_extensions', 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,zip,rar', 'string', 'Extensions de fichiers autorisées'),
('retention_period', '365', 'number', 'Période de rétention par défaut en jours'),
('enable_versioning', 'true', 'boolean', 'Activer le versioning des documents'),
('max_versions', '10', 'number', 'Nombre maximum de versions par document'),
('enable_workflows', 'true', 'boolean', 'Activer les workflows de validation'),
('enable_notifications', 'true', 'boolean', 'Activer les notifications'),
('session_timeout', '3600', 'number', 'Durée de session en secondes');

-- ============================================
-- Insertion d'un utilisateur admin par défaut
-- Mot de passe: Admin@123 (hashé avec bcrypt)
-- ============================================
INSERT INTO users (uuid, email, password, first_name, last_name, role_id, department, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@ged.local', '$2a$10$rQnM1.E6eiHRHvRYJ5HXxuN5Ew5Ew5K5K5K5K5K5K5K5K5K5K5K5K', 'Admin', 'Système', 1, 'IT', TRUE);
