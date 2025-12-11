import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    Activity, Filter, ChevronLeft, ChevronRight, User, FileText,
    Folder, Users, GitBranch, Share2, Settings
} from 'lucide-react';

const ACTION_LABELS = {
    login: 'Connexion',
    logout: 'Déconnexion',
    create: 'Création',
    update: 'Modification',
    delete: 'Suppression',
    upload: 'Upload',
    download: 'Téléchargement',
    view: 'Consultation',
    share_create: 'Partage créé',
    share_revoke: 'Partage révoqué',
    workflow_start: 'Workflow démarré',
    workflow_approve: 'Workflow approuvé',
    workflow_reject: 'Workflow rejeté',
    lock: 'Verrouillage',
    unlock: 'Déverrouillage',
    archive: 'Archivage'
};

const ENTITY_ICONS = {
    document: FileText,
    folder: Folder,
    user: Users,
    workflow: GitBranch,
    share: Share2,
    system: Settings
};

const ACTION_COLORS = {
    login: 'bg-green-100 text-green-700',
    logout: 'bg-gray-100 text-gray-700',
    create: 'bg-blue-100 text-blue-700',
    upload: 'bg-blue-100 text-blue-700',
    update: 'bg-yellow-100 text-yellow-700',
    delete: 'bg-red-100 text-red-700',
    download: 'bg-purple-100 text-purple-700',
    view: 'bg-gray-100 text-gray-700'
};

export default function ActivityLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({ entityType: '', action: '' });

    useEffect(() => {
        fetchLogs();
    }, [pagination.page, filters]);

    const fetchLogs = async () => {
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...(filters.entityType && { entityType: filters.entityType }),
                ...(filters.action && { action: filters.action })
            });

            const response = await api.get(`/stats/activity?${params}`);
            setLogs(response.data.data.logs);
            setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
        } catch (error) {
            toast.error('Erreur');
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action) => {
        for (const [key, color] of Object.entries(ACTION_COLORS)) {
            if (action.includes(key)) return color;
        }
        return 'bg-gray-100 text-gray-700';
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
                <h1 className="text-2xl font-bold text-gray-900">Journal d'activité</h1>
                <p className="text-gray-500 mt-1">Historique complet des actions sur le système</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Filtres:</span>
                    </div>
                    <select
                        value={filters.entityType}
                        onChange={(e) => {
                            setFilters(prev => ({ ...prev, entityType: e.target.value }));
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="">Tous les types</option>
                        <option value="document">Documents</option>
                        <option value="folder">Dossiers</option>
                        <option value="user">Utilisateurs</option>
                        <option value="workflow">Workflows</option>
                        <option value="share">Partages</option>
                    </select>
                    <select
                        value={filters.action}
                        onChange={(e) => {
                            setFilters(prev => ({ ...prev, action: e.target.value }));
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="">Toutes les actions</option>
                        <option value="login">Connexion</option>
                        <option value="create">Création</option>
                        <option value="update">Modification</option>
                        <option value="delete">Suppression</option>
                        <option value="upload">Upload</option>
                        <option value="download">Téléchargement</option>
                    </select>
                </div>
            </div>

            {/* Logs list */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Élément</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs.map((log) => {
                                const EntityIcon = ENTITY_ICONS[log.entityType] || Activity;
                                return (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleString('fr-FR')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {log.user ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                        <span className="text-primary-700 text-xs font-semibold">
                                                            {log.user.name.split(' ').map(n => n[0]).join('')}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-900">{log.user.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500">Système</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${getActionColor(log.action)}`}>
                                                {ACTION_LABELS[log.action] || log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <EntityIcon className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-600 capitalize">{log.entityType}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                                            {log.entityName || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                                            {log.ipAddress || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-gray-500">
                            Page {pagination.page} sur {pagination.totalPages} ({pagination.total} entrées)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page === pagination.totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
