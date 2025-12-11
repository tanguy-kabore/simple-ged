import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    GitBranch, Plus, Edit, Trash2, X, Users, ChevronRight
} from 'lucide-react';

export default function Workflows() {
    const { isAdmin } = useAuth();
    const [workflows, setWorkflows] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '', description: '', steps: [{ name: '', assigneeId: '' }]
    });

    useEffect(() => {
        fetchWorkflows();
        fetchUsers();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const response = await api.get('/workflows');
            setWorkflows(response.data.data);
        } catch (error) {
            toast.error('Erreur');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data.data.users.filter(u => 
                ['admin', 'manager'].includes(u.role.name)
            ));
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Valider les étapes
        const validSteps = formData.steps.filter(s => s.name && s.assigneeId);
        if (validSteps.length === 0) {
            toast.error('Au moins une étape complète est requise');
            return;
        }

        try {
            await api.post('/workflows', {
                ...formData,
                steps: validSteps
            });
            toast.success('Workflow créé');
            setShowModal(false);
            setFormData({ name: '', description: '', steps: [{ name: '', assigneeId: '' }] });
            fetchWorkflows();
        } catch (error) {
            toast.error('Erreur');
        }
    };

    const addStep = () => {
        setFormData(prev => ({
            ...prev,
            steps: [...prev.steps, { name: '', assigneeId: '' }]
        }));
    };

    const removeStep = (index) => {
        setFormData(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index)
        }));
    };

    const updateStep = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            steps: prev.steps.map((step, i) => 
                i === index ? { ...step, [field]: value } : step
            )
        }));
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
                    <p className="text-gray-500 mt-1">Gérez les circuits de validation</p>
                </div>
                {isAdmin() && (
                    <button onClick={() => setShowModal(true)} className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Nouveau workflow
                    </button>
                )}
            </div>

            {/* Workflows list */}
            <div className="grid gap-4">
                {workflows.length > 0 ? (
                    workflows.map((workflow) => (
                        <div key={workflow.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                                    {workflow.description && (
                                        <p className="text-gray-500 mt-1">{workflow.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`badge ${workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {workflow.isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                    <span className="text-sm text-gray-500">{workflow.usageCount} utilisation(s)</span>
                                </div>
                            </div>
                            
                            {/* Steps visualization */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                                {workflow.steps.map((step, idx) => (
                                    <div key={idx} className="flex items-center">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-lg border border-primary-200 whitespace-nowrap">
                                            <span className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                {idx + 1}
                                            </span>
                                            <span className="font-medium text-primary-700">{step.name}</span>
                                        </div>
                                        {idx < workflow.steps.length - 1 && (
                                            <ChevronRight className="w-5 h-5 text-gray-400 mx-1" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-gray-500">
                                <span>Créé par {workflow.createdBy}</span>
                                <span>{new Date(workflow.createdAt).toLocaleDateString('fr-FR')}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                        <GitBranch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Aucun workflow configuré</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Nouveau workflow</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    placeholder="Ex: Validation contrats"
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={2}
                                    className="input resize-none"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Étapes de validation *</label>
                                    <button
                                        type="button"
                                        onClick={addStep}
                                        className="text-sm text-primary-600 hover:text-primary-700"
                                    >
                                        + Ajouter une étape
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.steps.map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <span className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                                                {idx + 1}
                                            </span>
                                            <input
                                                type="text"
                                                value={step.name}
                                                onChange={(e) => updateStep(idx, 'name', e.target.value)}
                                                placeholder="Nom de l'étape"
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <select
                                                value={step.assigneeId}
                                                onChange={(e) => updateStep(idx, 'assigneeId', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="">Assigné à...</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.firstName} {u.lastName} ({u.role.name})
                                                    </option>
                                                ))}
                                            </select>
                                            {formData.steps.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeStep(idx)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                    Annuler
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Créer le workflow
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
