# GED - Gestion Électronique des Documents

Une solution complète de gestion électronique des documents pour entreprises, développée avec Node.js/Express et React.

![GED Screenshot](https://via.placeholder.com/800x400?text=GED+-+Gestion+Electronique+des+Documents)

## 🚀 Fonctionnalités

### Gestion des documents
- ✅ Upload de documents (simple et multiple)
- ✅ Recherche full-text avancée
- ✅ Gestion des versions avec historique
- ✅ Verrouillage de documents
- ✅ Archivage et rétention
- ✅ Commentaires et annotations
- ✅ Tags et métadonnées

### Organisation
- ✅ Structure de dossiers hiérarchique
- ✅ Catégories personnalisables
- ✅ Navigation par breadcrumb

### Workflows
- ✅ Circuits de validation configurables
- ✅ Étapes multiples avec assignation
- ✅ Approbation/Rejet avec commentaires
- ✅ Notifications automatiques

### Partage & Collaboration
- ✅ Liens de partage sécurisés (avec mot de passe optionnel)
- ✅ Partage avec utilisateurs spécifiques
- ✅ Permissions granulaires (lecture, édition, suppression)
- ✅ Expiration des partages

### Sécurité & Conformité
- ✅ Authentification JWT
- ✅ Gestion des rôles (Admin, Manager, User, Guest)
- ✅ Journal d'audit complet
- ✅ Traçabilité des actions
- ✅ Contrôle des accès

### Dashboard & Statistiques
- ✅ Tableau de bord avec KPIs
- ✅ Graphiques d'évolution
- ✅ Statistiques de stockage
- ✅ Activité récente

## 📋 Prérequis

- **Node.js** 18+ 
- **MySQL** 8.0+
- **npm** ou **yarn**

## 🛠️ Installation

### 1. Cloner le projet

```bash
cd C:\Users\HP\CascadeProjects\ged-app
```

### 2. Configuration de la base de données

Créez une base de données MySQL et configurez les identifiants :

```bash
cd backend
copy .env.example .env
```

Éditez le fichier `.env` avec vos paramètres MySQL :

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=ged_database
JWT_SECRET=votre_secret_jwt_securise
```

### 3. Initialiser la base de données

```bash
cd backend
npm install
npm run init-db
```

Cela créera :
- Toutes les tables nécessaires
- Les rôles par défaut (admin, manager, user, guest)
- Les catégories par défaut
- Un compte administrateur

### 4. Installer les dépendances du frontend

```bash
cd ../frontend
npm install
```

### 5. Démarrer l'application

**Terminal 1 - Backend :**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend :**
```bash
cd frontend
npm run dev
```

## 🔐 Connexion

Accédez à l'application : **http://localhost:3000**

**Compte administrateur par défaut :**
- Email : `admin@ged.local`
- Mot de passe : `Admin@123`

> ⚠️ **Important** : Changez le mot de passe après la première connexion !

## 📁 Structure du projet

```
ged-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (DB)
│   │   ├── controllers/     # Logique métier
│   │   ├── database/        # Scripts SQL
│   │   ├── middleware/      # Auth, Upload
│   │   ├── routes/          # Routes API
│   │   ├── utils/           # Utilitaires
│   │   └── server.js        # Point d'entrée
│   ├── uploads/             # Fichiers uploadés
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/             # Client Axios
│   │   ├── context/         # Contexte Auth
│   │   ├── layouts/         # Layouts
│   │   ├── pages/           # Pages React
│   │   └── App.jsx
│   └── package.json
│
└── README.md
```

## 🔌 API Endpoints

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/register` | Inscription |
| GET | `/api/auth/profile` | Profil utilisateur |
| PUT | `/api/auth/change-password` | Changer mot de passe |

### Documents
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/documents` | Liste des documents |
| POST | `/api/documents/upload` | Upload document |
| GET | `/api/documents/:id` | Détails document |
| PUT | `/api/documents/:id` | Modifier document |
| DELETE | `/api/documents/:id` | Supprimer document |
| GET | `/api/documents/:id/download` | Télécharger |
| POST | `/api/documents/:id/versions` | Nouvelle version |
| GET | `/api/documents/search` | Recherche |

### Dossiers
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/folders` | Arborescence |
| POST | `/api/folders` | Créer dossier |
| GET | `/api/folders/:id` | Contenu dossier |
| PUT | `/api/folders/:id` | Modifier |
| DELETE | `/api/folders/:id` | Supprimer |

### Workflows
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/workflows` | Liste workflows |
| POST | `/api/workflows` | Créer workflow |
| POST | `/api/workflows/start` | Démarrer instance |
| GET | `/api/workflows/tasks/my` | Mes tâches |
| POST | `/api/workflows/instances/:id/process` | Traiter étape |

### Utilisateurs (Admin)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users` | Liste utilisateurs |
| POST | `/api/users` | Créer utilisateur |
| PUT | `/api/users/:id` | Modifier |
| DELETE | `/api/users/:id` | Supprimer |

## 👥 Rôles et Permissions

| Rôle | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Administrateur système | Tous les droits |
| **Manager** | Gestionnaire | Documents, Dossiers, Workflows, Validation |
| **User** | Utilisateur standard | CRUD Documents/Dossiers, Participer aux workflows |
| **Guest** | Invité | Lecture seule |

## 🔧 Configuration avancée

### Variables d'environnement (Backend)

```env
# Base de données
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ged_database

# JWT
JWT_SECRET=votre_secret_tres_long_et_securise
JWT_EXPIRES_IN=24h

# Serveur
PORT=5000
NODE_ENV=development

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_EXTENSIONS=pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,zip,rar
```

### Formats de fichiers supportés

- **Documents** : PDF, DOC, DOCX, TXT, CSV
- **Tableurs** : XLS, XLSX
- **Présentations** : PPT, PPTX
- **Images** : JPG, JPEG, PNG, GIF
- **Archives** : ZIP, RAR

## 📊 Technologies utilisées

### Backend
- Node.js / Express.js
- MySQL avec mysql2
- JWT pour l'authentification
- Multer pour l'upload
- bcryptjs pour le hachage

### Frontend
- React 18
- React Router 6
- TailwindCSS
- Axios
- Recharts (graphiques)
- Lucide React (icônes)
- React Hot Toast (notifications)
- React Dropzone (upload)

## 🐛 Dépannage

### Erreur de connexion MySQL
Vérifiez que MySQL est démarré et que les identifiants dans `.env` sont corrects.

### Erreur "Port already in use"
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Les uploads ne fonctionnent pas
Vérifiez que le dossier `uploads/` existe et a les permissions d'écriture.

## 📝 Licence

MIT License - Libre d'utilisation pour tout projet.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

---

Développé avec ❤️ pour la gestion documentaire moderne.
