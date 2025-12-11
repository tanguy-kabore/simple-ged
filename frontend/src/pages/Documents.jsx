import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    Upload, FileText, Grid, List, Search, Filter, MoreVertical,
    Download, Trash2, Edit, Eye, Share2, Lock, Archive, X, ChevronLeft, ChevronRight, FilePlus
} from 'lucide-react';
import CreateDocumentModal from '../components/CreateDocumentModal';

const FILE_ICONS = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📽️', pptx: '📽️', txt: '📃', csv: '📊',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
    zip: '📦', rar: '📦', default: '📄'
};

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function StatusBadge({ status }) {
    const styles = {
        draft: 'bg-gray-100 text-gray-700',
        pending: 'bg-yellow-100 text-yellow-700',
        approved: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700',
        archived: 'bg-blue-100 text-blue-700'
    };

    const labels = {
        draft: 'Brouillon',
        pending: 'En attente',
        approved: 'Approuvé',
        rejected: 'Rejeté',
        archived: 'Archivé'
    };

    return (
        <span className={`badge ${styles[status] || styles.draft}`}>
            {labels[status] || status}
        </span>
    );
}

export default function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState('list');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({ search: '', categoryId: '', status: '' });
    const [uploadData, setUploadData] = useState({ title: '', description: '', categoryId: '', files: [] });

    useEffect(() => {
        fetchDocuments();
        fetchCategories();
        fetchFolders();
    }, [pagination.page, filters]);

    const fetchFolders = async () => {
        try {
            const response = await api.get('/folders?flat=true');
            setFolders(response.data.data || []);
        } catch (error) {
            console.error('Erreur chargement dossiers:', error);
        }
    };

    const fetchDocuments = async () => {
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...(filters.search && { search: filters.search }),
                ...(filters.categoryId && { categoryId: filters.categoryId }),
                ...(filters.status && { status: filters.status })
            });

            const response = await api.get(`/documents?${params}`);
            setDocuments(response.data.data.documents);
            setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
        } catch (error) {
            toast.error('Erreur lors du chargement des documents');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories');
            setCategories(response.data.data);
        } catch (error) {
            console.error('Erreur chargement catégories:', error);
        }
    };

    const onDrop = useCallback((acceptedFiles) => {
        setUploadData(prev => ({ ...prev, files: acceptedFiles }));
        if (!showUploadModal) setShowUploadModal(true);
    }, [showUploadModal]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
            'text/*': ['.txt', '.csv']
        }
    });

    const handleUpload = async () => {
        if (uploadData.files.length === 0) {
            toast.error('Veuillez sélectionner au moins un fichier');
            return;
        }

        setUploading(true);
        try {
            for (const file of uploadData.files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', uploadData.title || file.name);
                if (uploadData.description) formData.append('description', uploadData.description);
                if (uploadData.categoryId) formData.append('categoryId', uploadData.categoryId);

                await api.post('/documents/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            toast.success(`${uploadData.files.length} document(s) uploadé(s) avec succès`);
            setShowUploadModal(false);
            setUploadData({ title: '', description: '', categoryId: '', files: [] });
            fetchDocuments();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur lors de l\'upload');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

        try {
            await api.delete(`/documents/${docId}`);
            toast.success('Document supprimé');
            fetchDocuments();
        } catch (error) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleDownload = async (doc) => {
        try {
            const response = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Erreur lors du téléchargement');
        }
    };

    const flattenCategories = (cats, level = 0) => {
        return cats.reduce((acc, cat) => {
            acc.push({ ...cat, level });
            if (cat.children?.length) {
                acc.push(...flattenCategories(cat.children, level + 1));
            }
            return acc;
        }, []);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
                    <p className="text-gray-500 mt-1">{pagination.total} document(s)</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-secondary"
                    >
                        <FilePlus className="w-4 h-4" />
                        Créer
                    </button>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="btn btn-primary"
                    >
                        <Upload className="w-4 h-4" />
                        Importer
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        />
                    </div>
                    <select
                        value={filters.categoryId}
                        onChange={(e) => setFilters(prev => ({ ...prev, categoryId: e.target.value }))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                        <option value="">Toutes les catégories</option>
                        {flattenCategories(categories).map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {'  '.repeat(cat.level)}{cat.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                        <option value="">Tous les statuts</option>
                        <option value="draft">Brouillon</option>
                        <option value="pending">En attente</option>
                        <option value="approved">Approuvé</option>
                        <option value="rejected">Rejeté</option>
                        <option value="archived">Archivé</option>
                    </select>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Drop zone */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
                }`}
            >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                    {isDragActive ? 'Déposez les fichiers ici...' : 'Glissez-déposez des fichiers ou cliquez pour sélectionner'}
                </p>
                <p className="text-sm text-gray-400 mt-1">PDF, Word, Excel, Images (max 50 Mo)</p>
            </div>

            {/* Documents list/grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun document trouvé</p>
                </div>
            ) : viewMode === 'list' ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Catégorie</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Taille</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <Link to={`/documents/${doc.uuid}`} className="flex items-center gap-3">
                                            <span className="text-2xl">{FILE_ICONS[doc.fileType] || FILE_ICONS.default}</span>
                                            <div>
                                                <p className="font-medium text-gray-900 hover:text-primary-600">{doc.title}</p>
                                                <p className="text-sm text-gray-500">{doc.owner?.name}</p>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        {doc.category && (
                                            <span 
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                                style={{ backgroundColor: `${doc.category.color}20`, color: doc.category.color }}
                                            >
                                                {doc.category.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                                        {formatFileSize(doc.fileSize)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={doc.status} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                                        {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link
                                                to={`/documents/${doc.uuid}`}
                                                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                                                title="Voir"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                                                title="Télécharger"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {documents.map((doc) => (
                        <Link
                            key={doc.id}
                            to={`/documents/${doc.uuid}`}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="text-4xl text-center mb-3">
                                {FILE_ICONS[doc.fileType] || FILE_ICONS.default}
                            </div>
                            <p className="font-medium text-gray-900 truncate text-center">{doc.title}</p>
                            <p className="text-xs text-gray-500 text-center mt-1">{formatFileSize(doc.fileSize)}</p>
                            <div className="flex justify-center mt-2">
                                <StatusBadge status={doc.status} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
                    <p className="text-sm text-gray-500">
                        Page {pagination.page} sur {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            disabled={pagination.page === 1}
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Nouveau document</h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadData({ title: '', description: '', categoryId: '', files: [] });
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Files */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
                                    isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                                }`}
                            >
                                <input {...getInputProps()} />
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600">Cliquez ou déposez des fichiers</p>
                            </div>

                            {uploadData.files.length > 0 && (
                                <div className="space-y-2">
                                    {uploadData.files.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                            <span>{FILE_ICONS[file.name.split('.').pop()] || FILE_ICONS.default}</span>
                                            <span className="flex-1 truncate text-sm">{file.name}</span>
                                            <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                                            <button
                                                onClick={() => setUploadData(prev => ({
                                                    ...prev,
                                                    files: prev.files.filter((_, i) => i !== idx)
                                                }))}
                                                className="p-1 hover:bg-gray-200 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                                <input
                                    type="text"
                                    value={uploadData.title}
                                    onChange={(e) => setUploadData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Titre du document (optionnel)"
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={uploadData.description}
                                    onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Description (optionnelle)"
                                    rows={3}
                                    className="input resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                <select
                                    value={uploadData.categoryId}
                                    onChange={(e) => setUploadData(prev => ({ ...prev, categoryId: e.target.value }))}
                                    className="input"
                                >
                                    <option value="">Aucune catégorie</option>
                                    {flattenCategories(categories).map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {'  '.repeat(cat.level)}{cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadData({ title: '', description: '', categoryId: '', files: [] });
                                }}
                                className="btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading || uploadData.files.length === 0}
                                className="btn btn-primary"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Upload...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Uploader
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Document Modal */}
            <CreateDocumentModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={(doc) => {
                    fetchDocuments();
                    navigate(`/documents/${doc.uuid}`);
                }}
                categories={flattenCategories(categories)}
                folders={folders}
            />
        </div>
    );
}
