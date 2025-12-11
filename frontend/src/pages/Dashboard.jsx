import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    FileText, Folder, Users, GitBranch, Upload, Clock,
    TrendingUp, HardDrive, CheckCircle, AlertCircle, FileIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#6B7280'];

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function StatCard({ title, value, subtitle, icon: Icon, color, link }) {
    const content = (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow h-full`}>
            <div className="flex items-start justify-between">
                <div className="min-h-[70px]">
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                    <p className="text-sm text-gray-500 mt-1">{subtitle || '\u00A0'}</p>
                </div>
                <div className={`p-3 rounded-lg ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );

    return link ? <Link to={link}>{content}</Link> : content;
}

export default function Dashboard() {
    const { user, loading: authLoading } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Attendre que l'authentification soit terminée
        if (!authLoading && user) {
            fetchDashboard();
        }
    }, [authLoading, user]);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/stats/dashboard');
            setStats(response.data.data);
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Bonjour, {user?.firstName || 'Utilisateur'} 👋
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Voici un aperçu de votre espace documentaire
                    </p>
                </div>
                <Link
                    to="/documents"
                    className="btn btn-primary"
                >
                    <Upload className="w-4 h-4" />
                    Nouveau document
                </Link>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Documents"
                    value={stats?.overview?.documents?.active || 0}
                    subtitle={`${stats?.overview?.documents?.archived || 0} archivés`}
                    icon={FileText}
                    color="bg-primary-500"
                    link="/documents"
                />
                <StatCard
                    title="Dossiers"
                    value={stats?.overview?.folders || 0}
                    icon={Folder}
                    color="bg-green-500"
                    link="/folders"
                />
                <StatCard
                    title="Utilisateurs"
                    value={stats?.overview?.users?.active || 0}
                    subtitle={`${stats?.overview?.users?.total || 0} total`}
                    icon={Users}
                    color="bg-purple-500"
                    link="/users"
                />
                <StatCard
                    title="Workflows"
                    value={stats?.overview?.workflows?.inProgress || 0}
                    subtitle="en cours"
                    icon={GitBranch}
                    color="bg-orange-500"
                    link="/workflows"
                />
            </div>

            {/* Storage info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <HardDrive className="w-5 h-5 text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Stockage</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(((stats?.overview?.documents?.totalSize || 0) / (10 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                        ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        {formatFileSize(stats?.overview?.documents?.totalSize)} / 10 Go
                    </span>
                </div>
            </div>

            {/* Charts & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Documents par catégorie */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents par catégorie</h2>
                    {stats?.charts?.byCategory?.length > 0 ? (
                        <div>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.charts.byCategory}
                                            dataKey="count"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={65}
                                            paddingAngle={2}
                                            label={false}
                                        >
                                            {stats.charts.byCategory.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value, name) => [`${value} document(s)`, name]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                                {stats.charts.byCategory.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center gap-2">
                                        <div 
                                            className="w-3 h-3 rounded-full shrink-0" 
                                            style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
                                        />
                                        <span className="text-sm text-gray-600">{entry.name}: {entry.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            Aucune donnée disponible
                        </div>
                    )}
                </div>

                {/* Évolution mensuelle */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Évolution mensuelle</h2>
                    {stats?.charts?.monthlyTrend?.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.charts.monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            Aucune donnée disponible
                        </div>
                    )}
                </div>
            </div>

            {/* Recent documents & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Documents récents */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Documents récents</h2>
                        <Link to="/documents" className="text-sm text-primary-600 hover:text-primary-700">
                            Voir tout
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {stats?.recentDocuments?.length > 0 ? (
                            stats.recentDocuments.map((doc) => (
                                <Link
                                    key={doc.id}
                                    to={`/documents/${doc.uuid}`}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="p-2 bg-primary-50 rounded-lg">
                                        <FileIcon className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                                        <p className="text-xs text-gray-500">{doc.owner}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 uppercase">{doc.fileType}</span>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-4">Aucun document récent</p>
                        )}
                    </div>
                </div>

                {/* Activité récente */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Activité récente</h2>
                        {user?.role === 'admin' && (
                            <Link to="/activity" className="text-sm text-primary-600 hover:text-primary-700">
                                Voir tout
                            </Link>
                        )}
                    </div>
                    <div className="space-y-3">
                        {stats?.recentActivity?.length > 0 ? (
                            stats.recentActivity.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                                    <div className={`p-2 rounded-lg ${
                                        activity.action.includes('delete') ? 'bg-red-50' :
                                        activity.action.includes('create') || activity.action.includes('upload') ? 'bg-green-50' :
                                        'bg-blue-50'
                                    }`}>
                                        <Clock className={`w-4 h-4 ${
                                            activity.action.includes('delete') ? 'text-red-600' :
                                            activity.action.includes('create') || activity.action.includes('upload') ? 'text-green-600' :
                                            'text-blue-600'
                                        }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900">
                                            <span className="font-medium">{activity.user}</span>
                                            {' '}{activity.action === 'upload' ? 'a uploadé' :
                                                  activity.action === 'create' ? 'a créé' :
                                                  activity.action === 'update' ? 'a modifié' :
                                                  activity.action === 'delete' ? 'a supprimé' :
                                                  activity.action === 'login' ? 's\'est connecté' :
                                                  activity.action}{' '}
                                            {activity.entityName && <span className="font-medium">{activity.entityName}</span>}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(activity.createdAt).toLocaleString('fr-FR')}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-4">Aucune activité récente</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Document status overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">État des documents</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full mb-2">
                            <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.overview?.documents?.draft || 0}</p>
                        <p className="text-sm text-gray-500">Brouillons</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-yellow-200 rounded-full mb-2">
                            <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.overview?.documents?.pending || 0}</p>
                        <p className="text-sm text-gray-500">En attente</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-green-200 rounded-full mb-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.overview?.documents?.approved || 0}</p>
                        <p className="text-sm text-gray-500">Approuvés</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-200 rounded-full mb-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.overview?.documents?.total || 0}</p>
                        <p className="text-sm text-gray-500">Total</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
