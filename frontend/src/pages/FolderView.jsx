import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Folder, FileText, Upload, FolderPlus, ChevronRight, Home, 
    Download, Trash2, MoreVertical, X
} from 'lucide-react';

const FILE_ICONS = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📽️', pptx: '📽️', txt: '📃', default: '📄'
};

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FolderView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [folder, setFolder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        fetchFolder();
    }, [id]);

    const fetchFolder = async () => {
        try {
            const response = await api.get(`/folders/${id}`);
            setFolder(response.data.data);
        } catch (error) {
            toast.error('Dossier non trouvé');
            navigate('/folders');
        } finally {
            setLoading(false);
        }
    };

    const onDrop = useCallback((acceptedFiles) => {
        setUploadFiles(acceptedFiles);
        setShowUploadModal(true);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const handleUpload = async () => {
        if (uploadFiles.length === 0) return;

        setUploading(true);
        try {
            for (const file of uploadFiles) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', file.name);
                formData.append('folderId', folder.folder.id);

                await api.post('/documents/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            toast.success('Documents uploadés');
            setShowUploadModal(false);
            setUploadFiles([]);
            fetchFolder();
        } catch (error) {
            toast.error('Erreur lors de l\'upload');
        } finally {
            setUploading(false);
        }
    };

    const handleCreateSubfolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            await api.post('/folders', {
                name: newFolderName,
                parentId: folder.folder.id
            });
            toast.success('Sous-dossier créé');
            setShowFolderModal(false);
            setNewFolderName('');
            fetchFolder();
        } catch (error) {
            toast.error('Erreur lors de la création');
        }
    };

    const handleDeleteDocument = async (docId) => {
        if (!confirm('Supprimer ce document ?')) return;

        try {
            await api.delete(`/documents/${docId}`);
            toast.success('Document supprimé');
            fetchFolder();
        } catch (error) {
            toast.error('Erreur');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!folder) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate('/folders')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{folder.folder.name}</h1>
                        {folder.folder.description && (
                            <p className="text-gray-500 mt-1">{folder.folder.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFolderModal(true)}
                        className="btn btn-secondary"
                    >
                        <FolderPlus className="w-4 h-4" />
                        Sous-dossier
                    </button>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="btn btn-primary"
                    >
                        <Upload className="w-4 h-4" />
                        Upload
                    </button>
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <Link to="/folders" className="text-gray-500 hover:text-gray-700">
                    <Home className="w-4 h-4" />
                </Link>
                {folder.breadcrumb.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        {idx === folder.breadcrumb.length - 1 ? (
                            <span className="font-medium text-gray-900">{item.name}</span>
                        ) : (
                            <Link
                                to={`/folders/${item.uuid}`}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                {item.name}
                            </Link>
                        )}
                    </div>
                ))}
            </div>

            {/* Drop zone */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
                }`}
            >
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Déposez des fichiers ici</p>
            </div>

            {/* Subfolders */}
            {folder.subfolders.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Sous-dossiers</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {folder.subfolders.map((subfolder) => (
                            <Link
                                key={subfolder.id}
                                to={`/folders/${subfolder.uuid}`}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow text-center"
                            >
                                <Folder className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                                <p className="font-medium text-gray-900 truncate">{subfolder.name}</p>
                                <p className="text-xs text-gray-500">{subfolder.documentCount} doc(s)</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Documents */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Documents ({folder.documents.length})
                </h2>
                {folder.documents.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Taille</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Date</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {folder.documents.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <Link
                                                to={`/documents/${doc.uuid}`}
                                                className="flex items-center gap-3"
                                            >
                                                <span className="text-2xl">{FILE_ICONS[doc.fileType] || FILE_ICONS.default}</span>
                                                <div>
                                                    <p className="font-medium text-gray-900 hover:text-primary-600">{doc.title}</p>
                                                    <p className="text-sm text-gray-500">{doc.owner}</p>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                                            {formatFileSize(doc.fileSize)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                                            {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Aucun document dans ce dossier</p>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Upload de documents</h2>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer border-gray-300">
                                <input {...getInputProps()} />
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm">Sélectionner des fichiers</p>
                            </div>
                            {uploadFiles.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {uploadFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                            <span>{FILE_ICONS[file.name.split('.').pop()] || FILE_ICONS.default}</span>
                                            <span className="flex-1 truncate text-sm">{file.name}</span>
                                            <button onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== idx))}>
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">Annuler</button>
                            <button onClick={handleUpload} disabled={uploading || uploadFiles.length === 0} className="btn btn-primary">
                                {uploading ? 'Upload...' : 'Uploader'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Subfolder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Nouveau sous-dossier</h2>
                            <button onClick={() => setShowFolderModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Nom du sous-dossier"
                                className="input"
                            />
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button onClick={() => setShowFolderModal(false)} className="btn btn-secondary">Annuler</button>
                            <button onClick={handleCreateSubfolder} className="btn btn-primary">Créer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
