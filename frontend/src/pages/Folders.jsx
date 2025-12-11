import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    Folder, FolderPlus, ChevronRight, MoreVertical, Edit, Trash2, X
} from 'lucide-react';

export default function Folders() {
    const [folders, setFolders] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFolder, setNewFolder] = useState({ name: '', description: '', categoryId: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchFolders();
        fetchCategories();
    }, []);

    const fetchFolders = async () => {
        try {
            const response = await api.get('/folders');
            setFolders(response.data.data);
        } catch (error) {
            toast.error('Erreur lors du chargement des dossiers');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories');
            setCategories(response.data.data);
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const handleCreate = async () => {
        if (!newFolder.name.trim()) {
            toast.error('Nom du dossier requis');
            return;
        }

        setCreating(true);
        try {
            await api.post('/folders', newFolder);
            toast.success('Dossier créé');
            setShowCreateModal(false);
            setNewFolder({ name: '', description: '', categoryId: '' });
            fetchFolders();
        } catch (error) {
            toast.error('Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (folderId, e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!confirm('Supprimer ce dossier ?')) return;

        try {
            await api.delete(`/folders/${folderId}`);
            toast.success('Dossier supprimé');
            fetchFolders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur');
        }
    };

    const flattenCategories = (cats, level = 0) => {
        return cats.reduce((acc, cat) => {
            acc.push({ ...cat, level });
            if (cat.children?.length) acc.push(...flattenCategories(cat.children, level + 1));
            return acc;
        }, []);
    };

    const FolderTree = ({ items, level = 0 }) => (
        <div className={level > 0 ? 'ml-6' : ''}>
            {items.map((folder) => (
                <div key={folder.id}>
                    <Link
                        to={`/folders/${folder.uuid}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group"
                    >
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Folder className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{folder.name}</p>
                            <p className="text-sm text-gray-500">
                                {folder.subfolderCount} sous-dossiers • {folder.documentCount} documents
                            </p>
                        </div>
                        {folder.category && (
                            <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{ backgroundColor: `${folder.category.color}20`, color: folder.category.color }}
                            >
                                {folder.category.name}
                            </span>
                        )}
                        <button
                            onClick={(e) => handleDelete(folder.id, e)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                    {folder.children?.length > 0 && (
                        <FolderTree items={folder.children} level={level + 1} />
                    )}
                </div>
            ))}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dossiers</h1>
                    <p className="text-gray-500 mt-1">Organisez vos documents par dossiers</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                >
                    <FolderPlus className="w-4 h-4" />
                    Nouveau dossier
                </button>
            </div>

            {/* Folders tree */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                {folders.length > 0 ? (
                    <div className="p-4">
                        <FolderTree items={folders} />
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Aucun dossier</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn btn-primary mt-4"
                        >
                            <FolderPlus className="w-4 h-4" />
                            Créer un dossier
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Nouveau dossier</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom du dossier *
                                </label>
                                <input
                                    type="text"
                                    value={newFolder.name}
                                    onChange={(e) => setNewFolder(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Mon dossier"
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={newFolder.description}
                                    onChange={(e) => setNewFolder(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Description optionnelle"
                                    rows={3}
                                    className="input resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Catégorie
                                </label>
                                <select
                                    value={newFolder.categoryId}
                                    onChange={(e) => setNewFolder(prev => ({ ...prev, categoryId: e.target.value }))}
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
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="btn btn-primary"
                            >
                                {creating ? 'Création...' : 'Créer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
