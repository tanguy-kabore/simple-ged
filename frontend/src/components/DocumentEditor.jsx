import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Users, Download, FileText, RefreshCw, Loader2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

// Fonction pour nettoyer le HTML et extraire le texte
function cleanHtmlContent(html) {
    if (!html) return '';
    
    // Créer un élément temporaire pour parser le HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remplacer les balises de paragraphe et br par des sauts de ligne
    let text = temp.innerHTML
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<[^>]*>/g, '') // Supprimer toutes les autres balises
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Réduire les sauts de ligne multiples
        .trim();
    
    return text;
}

export default function DocumentEditor({ documentId, documentTitle, onClose, onSave }) {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editable, setEditable] = useState(false);
    const [collaborators, setCollaborators] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const textareaRef = useRef(null);
    const pollInterval = useRef(null);

    // Charger le contenu du document
    const loadContent = useCallback(async () => {
        try {
            const response = await api.get(`/documents/${documentId}/content`);
            const rawContent = response.data.data.content || '';
            // Nettoyer le HTML pour obtenir du texte simple
            const cleanedContent = cleanHtmlContent(rawContent);
            setContent(cleanedContent);
            setEditable(response.data.data.editable);
        } catch (error) {
            toast.error('Erreur lors du chargement du contenu');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    // Rejoindre la session de collaboration
    const joinSession = useCallback(async () => {
        try {
            const response = await api.post(`/documents/${documentId}/collaborate/join`);
            setCollaborators(response.data.data.activeUsers || []);
        } catch (error) {
            console.error('Erreur collaboration:', error);
        }
    }, [documentId]);

    // Quitter la session de collaboration
    const leaveSession = useCallback(async () => {
        try {
            await api.post(`/documents/${documentId}/collaborate/leave`);
        } catch (error) {
            console.error('Erreur déconnexion:', error);
        }
    }, [documentId]);

    // Récupérer les collaborateurs actifs
    const fetchCollaborators = useCallback(async () => {
        try {
            const response = await api.get(`/documents/${documentId}/collaborators`);
            setCollaborators(response.data.data || []);
        } catch (error) {
            console.error('Erreur collaborateurs:', error);
        }
    }, [documentId]);

    useEffect(() => {
        loadContent();
        joinSession();

        // Polling pour les collaborateurs (toutes les 30 secondes)
        pollInterval.current = setInterval(fetchCollaborators, 30000);

        return () => {
            leaveSession();
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [loadContent, joinSession, leaveSession, fetchCollaborators]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/documents/${documentId}/content`, {
                content,
                comment: 'Modification via l\'éditeur'
            });
            toast.success('Document sauvegardé !');
            setHasChanges(false);
            onSave?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const handleContentChange = (e) => {
        setContent(e.target.value);
        setHasChanges(true);
    };

    const handleClose = () => {
        if (hasChanges) {
            if (window.confirm('Vous avez des modifications non sauvegardées. Voulez-vous vraiment fermer ?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleDownload = async (format) => {
        try {
            const response = await api.post(`/documents/${documentId}/convert`, 
                { targetFormat: format },
                { responseType: 'blob' }
            );
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${documentTitle}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success(`Document exporté en ${format.toUpperCase()}`);
        } catch (error) {
            toast.error('Erreur lors de l\'export. Vérifiez que LibreOffice est installé sur le serveur.');
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                    <p className="text-gray-600">Chargement du document...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary-500" />
                        <h2 className="text-lg font-semibold">{documentTitle}</h2>
                        {hasChanges && (
                            <span className="badge bg-amber-100 text-amber-700">Non sauvegardé</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Collaborateurs */}
                        {collaborators.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                                <Users className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-700">
                                    {collaborators.length} utilisateur{collaborators.length > 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 p-2 border-b bg-gray-50 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={saving || !editable || !hasChanges}
                        className="btn btn-primary btn-sm"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Sauvegarder
                    </button>
                    <button
                        onClick={loadContent}
                        className="btn btn-secondary btn-sm"
                        title="Rafraîchir"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2" />
                    <div className="relative">
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="btn btn-secondary btn-sm"
                        >
                            <Download className="w-4 h-4" />
                            Exporter
                        </button>
                        {showExportMenu && (
                            <>
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowExportMenu(false)}
                                />
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border py-1 z-20 min-w-[150px]">
                                    <button
                                        onClick={() => { handleDownload('pdf'); setShowExportMenu(false); }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                                    >
                                        PDF
                                    </button>
                                    <button
                                        onClick={() => { handleDownload('html'); setShowExportMenu(false); }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                                    >
                                        HTML
                                    </button>
                                    <button
                                        onClick={() => { handleDownload('txt'); setShowExportMenu(false); }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                                    >
                                        Texte brut
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden p-4">
                    {editable ? (
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleContentChange}
                            className="w-full h-full p-6 bg-white border rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-base leading-relaxed"
                            placeholder="Commencez à écrire..."
                            style={{ minHeight: '100%' }}
                        />
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Ce document ne peut pas être édité directement</p>
                            <p className="mt-2">
                                Téléchargez-le pour le modifier avec votre application favorite.
                            </p>
                        </div>
                    )}
                </div>

                {/* Collaborators bar */}
                {collaborators.length > 0 && (
                    <div className="flex items-center gap-2 p-3 border-t bg-gray-50 shrink-0">
                        <span className="text-sm text-gray-500">En ligne :</span>
                        <div className="flex -space-x-2">
                            {collaborators.map((user, index) => (
                                <div
                                    key={user.id}
                                    className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-medium border-2 border-white"
                                    title={user.name}
                                >
                                    {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                            ))}
                        </div>
                        <span className="text-sm text-gray-600 ml-2">
                            {collaborators.map(u => u.name).join(', ')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
