import { useState } from 'react';
import { X, FileText, FileSpreadsheet, FileImage, File, Loader2, Download } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const conversionFormats = [
    { id: 'pdf', name: 'PDF', icon: FileImage, description: 'Document PDF', color: 'text-red-500' },
    { id: 'docx', name: 'Word', icon: FileText, description: 'Document Word (.docx)', color: 'text-blue-500' },
    { id: 'xlsx', name: 'Excel', icon: FileSpreadsheet, description: 'Tableur Excel (.xlsx)', color: 'text-green-500' },
    { id: 'html', name: 'HTML', icon: File, description: 'Page web (.html)', color: 'text-orange-500' },
    { id: 'txt', name: 'Texte', icon: File, description: 'Texte brut (.txt)', color: 'text-gray-500' },
];

export default function ConvertDocumentModal({ isOpen, onClose, document }) {
    const [selectedFormat, setSelectedFormat] = useState('');
    const [converting, setConverting] = useState(false);

    const handleConvert = async () => {
        if (!selectedFormat) {
            toast.error('Sélectionnez un format de conversion');
            return;
        }

        setConverting(true);
        try {
            const response = await api.post(
                `/documents/${document.id}/convert`,
                { targetFormat: selectedFormat },
                { responseType: 'blob' }
            );

            // Créer le lien de téléchargement
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = window.document.createElement('a');
            link.href = url;
            
            const baseName = document.title || document.fileName?.replace(/\.[^/.]+$/, '') || 'document';
            link.setAttribute('download', `${baseName}.${selectedFormat}`);
            
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Document converti en ${selectedFormat.toUpperCase()} avec succès !`);
            onClose();
        } catch (error) {
            console.error('Erreur conversion:', error);
            if (error.response?.status === 500) {
                toast.error('La conversion nécessite LibreOffice sur le serveur. Contactez l\'administrateur.');
            } else {
                toast.error(error.response?.data?.message || 'Erreur lors de la conversion');
            }
        } finally {
            setConverting(false);
        }
    };

    if (!isOpen || !document) return null;

    // Filtrer les formats disponibles (exclure le format actuel)
    const availableFormats = conversionFormats.filter(f => f.id !== document.fileType);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Convertir le document</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        disabled={converting}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Document source</p>
                        <p className="font-medium">{document.title}</p>
                        <p className="text-sm text-gray-500">
                            Format actuel: <span className="font-medium uppercase">{document.fileType}</span>
                        </p>
                    </div>

                    <p className="text-sm font-medium text-gray-700 mb-3">
                        Convertir vers :
                    </p>

                    <div className="space-y-2">
                        {availableFormats.map((format) => {
                            const Icon = format.icon;
                            return (
                                <button
                                    key={format.id}
                                    onClick={() => setSelectedFormat(format.id)}
                                    disabled={converting}
                                    className={`w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all ${
                                        selectedFormat === format.id
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${format.color}`} />
                                    <div className="text-left">
                                        <p className="font-medium">{format.name}</p>
                                        <p className="text-sm text-gray-500">{format.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {(document.fileType === 'xlsx' || document.fileType === 'pptx') && selectedFormat === 'pdf' && (
                        <p className="mt-3 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                            ⚠️ La conversion vers PDF nécessite LibreOffice installé sur le serveur.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 border-t">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={converting}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleConvert}
                        className="btn btn-primary"
                        disabled={!selectedFormat || converting}
                    >
                        {converting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Conversion...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Convertir et télécharger
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
