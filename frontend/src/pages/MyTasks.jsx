import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    CheckSquare, CheckCircle, XCircle, Clock, FileText, MessageSquare, X
} from 'lucide-react';

export default function MyTasks() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showActionModal, setShowActionModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [action, setAction] = useState('approve');
    const [comment, setComment] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await api.get('/workflows/tasks/my');
            setTasks(response.data.data);
        } catch (error) {
            toast.error('Erreur');
        } finally {
            setLoading(false);
        }
    };

    const openActionModal = (task, actionType) => {
        setSelectedTask(task);
        setAction(actionType);
        setComment('');
        setShowActionModal(true);
    };

    const handleProcess = async () => {
        if (!selectedTask) return;

        setProcessing(true);
        try {
            await api.post(`/workflows/instances/${selectedTask.instanceId}/process`, {
                action,
                comment
            });
            toast.success(action === 'approve' ? 'Étape approuvée' : 'Document rejeté');
            setShowActionModal(false);
            fetchTasks();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur');
        } finally {
            setProcessing(false);
        }
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
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Mes tâches</h1>
                <p className="text-gray-500 mt-1">{tasks.length} tâche(s) en attente</p>
            </div>

            {/* Tasks list */}
            {tasks.length > 0 ? (
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <div key={task.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-yellow-100 rounded-lg">
                                        <Clock className="w-6 h-6 text-yellow-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">{task.stepName}</h3>
                                        <p className="text-gray-500">Workflow: {task.workflowName}</p>
                                        <Link 
                                            to={`/documents/${task.document.uuid}`}
                                            className="inline-flex items-center gap-2 mt-2 text-primary-600 hover:text-primary-700"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {task.document.title}
                                        </Link>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Initié par {task.startedBy} • {new Date(task.createdAt).toLocaleString('fr-FR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openActionModal(task, 'reject')}
                                        className="btn btn-secondary text-red-600 hover:bg-red-50"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Rejeter
                                    </button>
                                    <button
                                        onClick={() => openActionModal(task, 'approve')}
                                        className="btn btn-success"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Approuver
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune tâche en attente</p>
                    <p className="text-sm text-gray-400 mt-1">Les documents à valider apparaîtront ici</p>
                </div>
            )}

            {/* Action Modal */}
            {showActionModal && selectedTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">
                                {action === 'approve' ? 'Approuver' : 'Rejeter'} le document
                            </h2>
                            <button onClick={() => setShowActionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="font-medium text-gray-900">{selectedTask.document.title}</p>
                                <p className="text-sm text-gray-500">Étape: {selectedTask.stepName}</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Commentaire {action === 'reject' && '(obligatoire)'}
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Ajoutez un commentaire..."
                                    rows={3}
                                    required={action === 'reject'}
                                    className="input resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button onClick={() => setShowActionModal(false)} className="btn btn-secondary">
                                Annuler
                            </button>
                            <button
                                onClick={handleProcess}
                                disabled={processing || (action === 'reject' && !comment.trim())}
                                className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                            >
                                {processing ? 'Traitement...' : action === 'approve' ? 'Approuver' : 'Rejeter'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
