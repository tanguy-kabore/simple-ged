import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    Users as UsersIcon, UserPlus, Search, Edit, Trash2, Key, X,
    CheckCircle, XCircle, Mail, Phone, Building
} from 'lucide-react';

const ROLE_STYLES = {
    admin: { bg: 'bg-red-100', text: 'text-red-700' },
    manager: { bg: 'bg-purple-100', text: 'text-purple-700' },
    user: { bg: 'bg-blue-100', text: 'text-blue-700' },
    guest: { bg: 'bg-gray-100', text: 'text-gray-700' }
};

export default function Users() {
    const { user: currentUser, isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        email: '', password: '', firstName: '', lastName: '',
        phone: '', department: '', roleId: 3, isActive: true
    });

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data.data.users);
        } catch (error) {
            toast.error('Erreur lors du chargement des utilisateurs');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await api.get('/users/roles');
            setRoles(response.data.data);
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    phone: formData.phone,
                    department: formData.department,
                    roleId: formData.roleId,
                    isActive: formData.isActive
                });
                toast.success('Utilisateur modifié');
            } else {
                await api.post('/users', formData);
                toast.success('Utilisateur créé');
            }
            
            setShowModal(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur');
        }
    };

    const handleDelete = async (userId) => {
        if (!confirm('Supprimer cet utilisateur ?')) return;

        try {
            await api.delete(`/users/${userId}`);
            toast.success('Utilisateur supprimé');
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erreur');
        }
    };

    const handleResetPassword = async (userId) => {
        const newPassword = prompt('Nouveau mot de passe (min 8 caractères):');
        if (!newPassword || newPassword.length < 8) {
            toast.error('Mot de passe invalide');
            return;
        }

        try {
            await api.post(`/users/${userId}/reset-password`, { newPassword });
            toast.success('Mot de passe réinitialisé');
        } catch (error) {
            toast.error('Erreur');
        }
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '',
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone || '',
            department: user.department || '',
            roleId: user.role.id,
            isActive: user.isActive
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingUser(null);
        setFormData({
            email: '', password: '', firstName: '', lastName: '',
            phone: '', department: '', roleId: 3, isActive: true
        });
    };

    const filteredUsers = users.filter(u => 
        u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
                    <p className="text-gray-500 mt-1">{users.length} utilisateur(s)</p>
                </div>
                {isAdmin() && (
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="btn btn-primary"
                    >
                        <UserPlus className="w-4 h-4" />
                        Nouvel utilisateur
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
            </div>

            {/* Users table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Département</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                            <span className="text-primary-700 font-semibold">
                                                {user.firstName[0]}{user.lastName[0]}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                                    {user.department || '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`badge ${ROLE_STYLES[user.role.name]?.bg} ${ROLE_STYLES[user.role.name]?.text}`}>
                                        {user.role.name}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {user.isActive ? (
                                        <span className="badge bg-green-100 text-green-700">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Actif
                                        </span>
                                    ) : (
                                        <span className="badge bg-red-100 text-red-700">
                                            <XCircle className="w-3 h-3 mr-1" />
                                            Inactif
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        {isAdmin() && (
                                            <>
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                                                    title="Modifier"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(user.id)}
                                                    className="p-2 text-gray-500 hover:text-orange-600 hover:bg-gray-100 rounded-lg"
                                                    title="Réinitialiser mot de passe"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                {user.email !== 'admin@ged.local' && (
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">
                                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                        required
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                        required
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                    disabled={!!editingUser}
                                    className="input disabled:bg-gray-100"
                                />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                        minLength={8}
                                        className="input"
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                                <select
                                    value={formData.roleId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, roleId: parseInt(e.target.value) }))}
                                    className="input"
                                >
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name} - {role.description}</option>
                                    ))}
                                </select>
                            </div>
                            {editingUser && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                        className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <label htmlFor="isActive" className="text-sm text-gray-700">Compte actif</label>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                    Annuler
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingUser ? 'Enregistrer' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
