import { useState } from 'react';
import { X, FileText, Table, Presentation, Loader2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const documentTypes = [
    {
        id: 'docx',
        name: 'Document Word',
        description: 'Créer un document texte (.docx)',
        icon: FileText,
        color: 'bg-blue-500',
        bgLight: 'bg-blue-50',
        textColor: 'text-blue-600'
    },
    {
        id: 'xlsx',
        name: 'Feuille Excel',
        description: 'Créer un tableur (.xlsx)',
        icon: Table,
        color: 'bg-green-500',
        bgLight: 'bg-green-50',
        textColor: 'text-green-600'
    },
    {
        id: 'pptx',
        name: 'Présentation PowerPoint',
        description: 'Créer une présentation (.pptx)',
        icon: Presentation,
        color: 'bg-orange-500',
        bgLight: 'bg-orange-50',
        textColor: 'text-orange-600'
    }
];

export default function CreateDocumentModal({ isOpen, onClose, onSuccess, categories = [], folders = [] }) {
    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [folderId, setFolderId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!title.trim()) {
            toast.error('Le titre est requis');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/documents/create', {
                title: title.trim(),
                type: selectedType,
                description,
                categoryId: categoryId || null,
                folderId: folderId || null
            });

            toast.success('Document créé avec succès !');
            onSuccess?.(response.data.data);
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur lors de la création');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setSelectedType(null);
        setTitle('');
        setDescription('');
        setCategoryId('');
        setFolderId('');
        onClose();
    };

    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setStep(2);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h2 className="text-lg font-semibold">
                        {step === 1 ? 'Créer un nouveau document' : 'Détails du document'}
                    </h2>
                    <button 
                        onClick={handleClose} 
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {step === 1 ? (
                        <div className="space-y-3">
                            <p className="text-gray-600 mb-4">
                                Sélectionnez le type de document à créer :
                            </p>
                            {documentTypes.map((type) => {
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => handleTypeSelect(type.id)}
                                        className={`w-full p-4 rounded-xl border-2 border-transparent hover:border-primary-500 ${type.bgLight} transition-all flex items-center gap-4 text-left`}
                                    >
                                        <div className={`p-3 rounded-lg ${type.color}`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className={`font-semibold ${type.textColor}`}>
                                                {type.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {type.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Type sélectionné */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                {(() => {
                                    const type = documentTypes.find(t => t.id === selectedType);
                                    const Icon = type?.icon || FileText;
                                    return (
                                        <>
                                            <div className={`p-2 rounded-lg ${type?.color || 'bg-gray-500'}`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <span className="font-medium">{type?.name}</span>
                                            <button 
                                                onClick={() => setStep(1)}
                                                className="ml-auto text-sm text-primary-600 hover:underline"
                                            >
                                                Changer
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Titre */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Titre du document *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Mon document"
                                    className="input"
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (optionnel)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Description du document..."
                                    rows={2}
                                    className="input resize-none"
                                />
                            </div>

                            {/* Catégorie */}
                            {categories.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Catégorie
                                    </label>
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="input"
                                    >
                                        <option value="">Aucune catégorie</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Dossier */}
                            {folders.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Dossier
                                    </label>
                                    <select
                                        value={folderId}
                                        onChange={(e) => setFolderId(e.target.value)}
                                        className="input"
                                    >
                                        <option value="">Aucun dossier</option>
                                        {folders.map((folder) => (
                                            <option key={folder.id} value={folder.id}>
                                                {folder.path || folder.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 2 && (
                    <div className="flex justify-end gap-2 p-4 border-t shrink-0 bg-white">
                        <button
                            onClick={() => setStep(1)}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Retour
                        </button>
                        <button
                            onClick={handleCreate}
                            className="btn btn-primary"
                            disabled={!title.trim() || loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Création...
                                </>
                            ) : (
                                'Créer le document'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
