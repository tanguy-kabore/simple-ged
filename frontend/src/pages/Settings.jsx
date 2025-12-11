import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Save, Plus, Trash2, X } from 'lucide-react';

export default function Settings() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#3B82F6', icon: 'folder' });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories');
            setCategories(response.data.data);
        } catch (error) {
            toast.error('Erreur');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            await api.post('/categories', newCategory);
            toast.success('Catégorie créée');
            setShowCategoryModal(false);
            setNewCategory({ name: '', description: '', color: '#3B82F6', icon: 'folder' });
            fetchCategories();
        } catch (error) {
            toast.error('Erreur');
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('Supprimer cette catégorie ?')) return;
        try {
            await api.delete(`/categories/${id}`);
            toast.success('Catégorie supprimée');
            fetchCategories();
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
                <p className="text-gray-500 mt-1">Configuration du système GED</p>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Catégories</h2>
                    <button onClick={() => setShowCategoryModal(true)} className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Nouvelle catégorie
                    </button>
                </div>

                <div className="space-y-2">
                    {flattenCategories(categories).map((category) => (
                        <div
                            key={category.id}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                            style={{ marginLeft: `${category.level * 24}px` }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                />
                                <div>
                                    <p className="font-medium text-gray-900">{category.name}</p>
                                    {category.description && (
                                        <p className="text-sm text-gray-500">{category.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-500">
                                    {category.documentCount} doc(s) • {category.folderCount} dossier(s)
                                </span>
                                <button
                                    onClick={() => handleDeleteCategory(category.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* System info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations système</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Version</p>
                        <p className="font-medium text-gray-900">1.0.0</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Taille max fichier</p>
                        <p className="font-medium text-gray-900">50 Mo</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Extensions autorisées</p>
                        <p className="font-medium text-gray-900 text-sm">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, PNG, GIF, ZIP, RAR</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Versioning</p>
                        <p className="font-medium text-gray-900">Activé (max 10 versions)</p>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Nouvelle catégorie</h2>
                            <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateCategory} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                                <input
                                    type="text"
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={newCategory.description}
                                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                                    rows={2}
                                    className="input resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={newCategory.color}
                                        onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                                        className="w-10 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={newCategory.color}
                                        onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                                        className="input flex-1"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn btn-secondary">
                                    Annuler
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Créer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
