import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, Download, Edit, Trash2, Share2, Lock, Unlock, Archive,
    Clock, User, Folder, Tag, FileText, MessageSquare, GitBranch,
    ChevronDown, Send, RotateCcw, CheckCircle, XCircle, Play, FolderInput, X, Upload,
    FileOutput, Users, PenTool
} from 'lucide-react';
import DocumentEditor from '../components/DocumentEditor';
import ConvertDocumentModal from '../components/ConvertDocumentModal';

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const STATUS_STYLES = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Brouillon' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approuvé' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeté' },
    archived: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Archivé' }
};

export default function DocumentView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('details');
    const [newComment, setNewComment] = useState('');
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState('');
    const [showWorkflowModal, setShowWorkflowModal] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [versionFile, setVersionFile] = useState(null);
    const [versionComment, setVersionComment] = useState('');
    const [uploadingVersion, setUploadingVersion] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);

    useEffect(() => {
        fetchDocument();
        fetchWorkflows();
        fetchFolders();
    }, [id]);

    const fetchDocument = async () => {
        try {
            const response = await api.get(`/documents/${id}`);
            setDocument(response.data.data);
        } catch (error) {
            toast.error('Document non trouvé');
            navigate('/documents');
        } finally {
            setLoading(false);
        }
    };

    const fetchWorkflows = async () => {
        try {
            const response = await api.get('/workflows?active=true');
            setWorkflows(response.data.data);
        } catch (error) {
            console.error('Erreur chargement workflows:', error);
        }
    };

    const fetchFolders = async () => {
        try {
            const response = await api.get('/folders?flat=true');
            // Trier par chemin pour avoir une hiérarchie visuelle
            const sortedFolders = response.data.data.sort((a, b) => a.path.localeCompare(b.path));
            setFolders(sortedFolders);
        } catch (error) {
            console.error('Erreur chargement dossiers:', error);
        }
    };

    const handleMoveToFolder = async () => {
        try {
            await api.put(`/documents/${document.id}`, { folderId: selectedFolder || null });
            toast.success(selectedFolder ? 'Document déplacé dans le dossier' : 'Document retiré du dossier');
            setShowMoveModal(false);
            fetchDocument();
        } catch (error) {
            toast.error('Erreur lors du déplacement');
        }
    };

    const handleCreateVersion = async () => {
        if (!versionFile) {
            toast.error('Sélectionnez un fichier');
            return;
        }

        setUploadingVersion(true);
        try {
            const formData = new FormData();
            formData.append('file', versionFile);
            formData.append('comment', versionComment);

            await api.post(`/documents/${document.id}/versions`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Nouvelle version créée avec succès');
            setShowVersionModal(false);
            setVersionFile(null);
            setVersionComment('');
            fetchDocument();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur lors de la création de la version');
        } finally {
            setUploadingVersion(false);
        }
    };

    const handleResubmit = async () => {
        try {
            await api.put(`/documents/${document.id}`, { status: 'draft' });
            toast.success('Document remis en brouillon. Vous pouvez maintenant le modifier et le resoumettre.');
            fetchDocument();
        } catch (error) {
            toast.error('Erreur lors de la resoumission');
        }
    };

    const handleDownload = async (version = null) => {
        try {
            const url = version 
                ? `/documents/${document.id}/download?version=${version}`
                : `/documents/${document.id}/download`;
            
            const response = await api.get(url, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = window.document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', document.fileName);
            window.document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Erreur lors du téléchargement');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

        try {
            await api.delete(`/documents/${document.id}`);
            toast.success('Document supprimé');
            navigate('/documents');
        } catch (error) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleToggleLock = async () => {
        try {
            await api.post(`/documents/${document.id}/lock`);
            toast.success(document.isLocked ? 'Document déverrouillé' : 'Document verrouillé');
            fetchDocument();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur');
        }
    };

    const handleArchive = async () => {
        if (!confirm('Archiver ce document ?')) return;

        try {
            await api.post(`/documents/${document.id}/archive`);
            toast.success('Document archivé');
            fetchDocument();
        } catch (error) {
            toast.error('Erreur lors de l\'archivage');
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        try {
            await api.post(`/documents/${document.id}/comments`, { content: newComment });
            toast.success('Commentaire ajouté');
            setNewComment('');
            fetchDocument();
        } catch (error) {
            toast.error('Erreur lors de l\'ajout du commentaire');
        }
    };

    const handleStartWorkflow = async () => {
        if (!selectedWorkflow) {
            toast.error('Sélectionnez un workflow');
            return;
        }

        try {
            await api.post('/workflows/start', {
                workflowId: selectedWorkflow,
                documentId: document.id
            });
            toast.success('Workflow démarré');
            setShowWorkflowModal(false);
            fetchDocument();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!document) return null;

    const status = STATUS_STYLES[document.status] || STATUS_STYLES.draft;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
                            <span className={`badge ${status.bg} ${status.text}`}>
                                {status.label}
                            </span>
                            {document.isLocked && (
                                <span className="badge bg-red-100 text-red-700">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Verrouillé
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 mt-1">{document.fileName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleDownload()}
                        className="btn btn-secondary"
                    >
                        <Download className="w-4 h-4" />
                        Télécharger
                    </button>
                    {document.status === 'draft' && (
                        <button
                            onClick={() => setShowWorkflowModal(true)}
                            className="btn btn-primary"
                        >
                            <Play className="w-4 h-4" />
                            Démarrer validation
                        </button>
                    )}
                    {document.status === 'rejected' && (
                        <button
                            onClick={handleResubmit}
                            className="btn btn-warning"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Resoumettre
                        </button>
                    )}
                    <div className="relative">
                        <button 
                            onClick={() => setShowActionsMenu(!showActionsMenu)}
                            className="btn btn-secondary"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        {showActionsMenu && (
                            <>
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowActionsMenu(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                    {['docx', 'txt'].includes(document.fileType) && (
                                        <button
                                            onClick={() => { setShowEditor(true); setShowActionsMenu(false); }}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            <PenTool className="w-4 h-4" />
                                            Éditer le contenu
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setShowConvertModal(true); setShowActionsMenu(false); }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <FileOutput className="w-4 h-4" />
                                        Convertir
                                    </button>
                                    <button
                                        onClick={() => { setShowMoveModal(true); setShowActionsMenu(false); setSelectedFolder(document.folder?.id || ''); }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <FolderInput className="w-4 h-4" />
                                        Déplacer vers dossier
                                    </button>
                                    <button
                                        onClick={() => { handleToggleLock(); setShowActionsMenu(false); }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        {document.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                        {document.isLocked ? 'Déverrouiller' : 'Verrouiller'}
                                    </button>
                                    <button
                                        onClick={() => { handleArchive(); setShowActionsMenu(false); }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <Archive className="w-4 h-4" />
                                        Archiver
                                    </button>
                                    <button
                                        onClick={() => { handleDelete(); setShowActionsMenu(false); }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Supprimer
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    {['details', 'versions', 'comments'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab === 'details' && 'Détails'}
                            {tab === 'versions' && `Versions (${document.versions?.length || 0})`}
                            {tab === 'comments' && `Commentaires (${document.comments?.length || 0})`}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2">
                    {activeTab === 'details' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                            {document.description && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                                    <p className="text-gray-900">{document.description}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Type de fichier</h3>
                                    <p className="text-gray-900 uppercase">{document.fileType}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Taille</h3>
                                    <p className="text-gray-900">{formatFileSize(document.fileSize)}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Version actuelle</h3>
                                    <p className="text-gray-900">v{document.currentVersion}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Checksum</h3>
                                    <p className="text-gray-900 text-xs font-mono truncate">{document.checksum}</p>
                                </div>
                            </div>

                            {document.tags?.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {document.tags.map((tag, idx) => (
                                            <span key={idx} className="badge bg-gray-100 text-gray-700">
                                                <Tag className="w-3 h-3 mr-1" />
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'versions' && (
                        <div className="space-y-4">
                            {/* Bouton nouvelle version */}
                            {!document.isLocked && (
                                <button
                                    onClick={() => setShowVersionModal(true)}
                                    className="btn btn-primary w-full"
                                >
                                    <Upload className="w-4 h-4" />
                                    Créer une nouvelle version
                                </button>
                            )}
                            
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                {document.versions?.length > 0 ? (
                                    <div className="divide-y divide-gray-200">
                                        {document.versions.map((version, index) => (
                                            <div key={version.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${index === 0 ? 'bg-green-100' : 'bg-primary-100'}`}>
                                                        <span className={`font-semibold ${index === 0 ? 'text-green-700' : 'text-primary-700'}`}>v{version.versionNumber}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-gray-900">{version.fileName}</p>
                                                            {index === 0 && (
                                                                <span className="badge bg-green-100 text-green-700">Actuelle</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500">
                                                            {version.createdBy} • {new Date(version.createdAt).toLocaleString('fr-FR')}
                                                        </p>
                                                        {version.comment && (
                                                            <p className="text-sm text-gray-600 mt-1">{version.comment}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-500">{formatFileSize(version.fileSize)}</span>
                                                    <button
                                                        onClick={() => handleDownload(version.versionNumber)}
                                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                                        title="Télécharger cette version"
                                                    >
                                                        <Download className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="p-6 text-center text-gray-500">Aucune version antérieure</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'comments' && (
                        <div className="space-y-4">
                            {/* Add comment */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                                        <span className="text-primary-700 font-semibold text-sm">
                                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Ajouter un commentaire..."
                                            rows={3}
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={handleAddComment}
                                                disabled={!newComment.trim()}
                                                className="btn btn-primary"
                                            >
                                                <Send className="w-4 h-4" />
                                                Envoyer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comments list */}
                            {document.comments?.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-200">
                                    {document.comments.map((comment) => (
                                        <div key={comment.id} className="p-4">
                                            <div className="flex gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                                                    <span className="text-gray-600 font-semibold text-sm">
                                                        {comment.user.name.split(' ').map(n => n[0]).join('')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-gray-900">{comment.user.name}</p>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(comment.createdAt).toLocaleString('fr-FR')}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-700 mt-1">{comment.content}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-500">
                                    Aucun commentaire
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Info card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Propriétaire</p>
                                <p className="font-medium text-gray-900">{document.owner?.name}</p>
                            </div>
                        </div>

                        {document.category && (
                            <div className="flex items-center gap-3">
                                <Tag className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-500">Catégorie</p>
                                    <span
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                        style={{ backgroundColor: `${document.category.color}20`, color: document.category.color }}
                                    >
                                        {document.category.name}
                                    </span>
                                </div>
                            </div>
                        )}

                        {document.folder && (
                            <div className="flex items-center gap-3">
                                <Folder className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-500">Dossier</p>
                                    <Link
                                        to={`/folders/${document.folder.uuid}`}
                                        className="font-medium text-primary-600 hover:text-primary-700"
                                    >
                                        {document.folder.name}
                                    </Link>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Créé le</p>
                                <p className="font-medium text-gray-900">
                                    {new Date(document.createdAt).toLocaleString('fr-FR')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <RotateCcw className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Modifié le</p>
                                <p className="font-medium text-gray-900">
                                    {new Date(document.updatedAt).toLocaleString('fr-FR')}
                                </p>
                            </div>
                        </div>

                        {document.lockedBy && (
                            <div className="flex items-center gap-3">
                                <Lock className="w-5 h-5 text-red-400" />
                                <div>
                                    <p className="text-sm text-gray-500">Verrouillé par</p>
                                    <p className="font-medium text-gray-900">{document.lockedBy.name}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Workflow Modal */}
            {showWorkflowModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-4 border-b">
                            <h2 className="text-lg font-semibold">Démarrer un workflow</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-gray-600">
                                Sélectionnez un workflow de validation pour ce document.
                            </p>
                            <select
                                value={selectedWorkflow}
                                onChange={(e) => setSelectedWorkflow(e.target.value)}
                                className="input"
                            >
                                <option value="">Sélectionner un workflow</option>
                                {workflows.map((wf) => (
                                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button
                                onClick={() => setShowWorkflowModal(false)}
                                className="btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleStartWorkflow}
                                className="btn btn-primary"
                            >
                                <Play className="w-4 h-4" />
                                Démarrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move to Folder Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Déplacer vers un dossier</h2>
                            <button onClick={() => setShowMoveModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-gray-600">
                                Sélectionnez le dossier de destination pour ce document.
                            </p>
                            <select
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                                className="input"
                            >
                                <option value="">Aucun dossier (racine)</option>
                                {folders.map((folder) => (
                                    <option key={folder.id} value={folder.id}>
                                        {folder.path}
                                    </option>
                                ))}
                            </select>
                            {document.folder && (
                                <p className="text-sm text-gray-500">
                                    Dossier actuel: <span className="font-medium">{document.folder.name}</span>
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button
                                onClick={() => setShowMoveModal(false)}
                                className="btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleMoveToFolder}
                                className="btn btn-primary"
                            >
                                <FolderInput className="w-4 h-4" />
                                Déplacer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Version Modal */}
            {showVersionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Créer une nouvelle version</h2>
                            <button onClick={() => setShowVersionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-gray-600">
                                Uploadez un nouveau fichier pour créer la version {(document.currentVersion || 1) + 1}.
                            </p>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fichier *</label>
                                <input
                                    type="file"
                                    onChange={(e) => setVersionFile(e.target.files[0])}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                />
                                {versionFile && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        {versionFile.name} ({formatFileSize(versionFile.size)})
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire (optionnel)</label>
                                <textarea
                                    value={versionComment}
                                    onChange={(e) => setVersionComment(e.target.value)}
                                    placeholder="Décrivez les modifications apportées..."
                                    rows={3}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button
                                onClick={() => { setShowVersionModal(false); setVersionFile(null); setVersionComment(''); }}
                                className="btn btn-secondary"
                                disabled={uploadingVersion}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateVersion}
                                className="btn btn-primary"
                                disabled={!versionFile || uploadingVersion}
                            >
                                {uploadingVersion ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Upload...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Créer la version
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Editor */}
            {showEditor && (
                <DocumentEditor
                    documentId={document.id}
                    documentTitle={document.title}
                    onClose={() => setShowEditor(false)}
                    onSave={() => fetchDocument()}
                />
            )}

            {/* Convert Document Modal */}
            <ConvertDocumentModal
                isOpen={showConvertModal}
                onClose={() => setShowConvertModal(false)}
                document={document}
            />
        </div>
    );
}
