import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { Search as SearchIcon, FileText, Filter, X } from 'lucide-react';

const FILE_ICONS = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', default: '📄'
};

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [filters, setFilters] = useState({ category: '', type: '', status: '' });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            performSearch(q);
        }
    }, [searchParams]);

    const performSearch = async (searchQuery) => {
        if (!searchQuery || searchQuery.length < 2) return;

        setLoading(true);
        setSearched(true);

        try {
            const params = new URLSearchParams({ q: searchQuery });
            if (filters.category) params.append('category', filters.category);
            if (filters.type) params.append('type', filters.type);
            if (filters.status) params.append('status', filters.status);

            const response = await api.get(`/documents/search?${params}`);
            setResults(response.data.data.results);
        } catch (error) {
            console.error('Erreur recherche:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (query.trim()) {
            setSearchParams({ q: query });
            performSearch(query);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Recherche</h1>
                <p className="text-gray-500 mt-1">Recherchez des documents par mots-clés</p>
            </div>

            {/* Search form */}
            <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher des documents..."
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-lg"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                >
                    <Filter className="w-4 h-4" />
                    Filtres
                </button>
                <button type="submit" className="btn btn-primary">
                    Rechercher
                </button>
            </form>

            {/* Filters */}
            {showFilters && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type de fichier</label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                                className="input"
                            >
                                <option value="">Tous</option>
                                <option value="pdf">PDF</option>
                                <option value="doc">Word</option>
                                <option value="xls">Excel</option>
                                <option value="txt">Texte</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                className="input"
                            >
                                <option value="">Tous</option>
                                <option value="draft">Brouillon</option>
                                <option value="pending">En attente</option>
                                <option value="approved">Approuvé</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({ category: '', type: '', status: '' })}
                                className="btn btn-secondary"
                            >
                                <X className="w-4 h-4" />
                                Réinitialiser
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : searched ? (
                results.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-gray-600">{results.length} résultat(s) trouvé(s)</p>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-200">
                            {results.map((doc) => (
                                <Link
                                    key={doc.id}
                                    to={`/documents/${doc.uuid}`}
                                    className="flex items-center gap-4 p-4 hover:bg-gray-50"
                                >
                                    <span className="text-3xl">{FILE_ICONS[doc.fileType] || FILE_ICONS.default}</span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 hover:text-primary-600">{doc.title}</h3>
                                        {doc.description && (
                                            <p className="text-sm text-gray-500 truncate">{doc.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                            <span>{doc.owner}</span>
                                            <span>{formatFileSize(doc.fileSize)}</span>
                                            <span>{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                    {doc.category && (
                                        <span
                                            className="px-2 py-1 rounded-full text-xs font-medium"
                                            style={{ backgroundColor: `${doc.categoryColor}20`, color: doc.categoryColor }}
                                        >
                                            {doc.category}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                        <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Aucun résultat pour "{query}"</p>
                        <p className="text-sm text-gray-400 mt-1">Essayez d'autres termes de recherche</p>
                    </div>
                )
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Entrez un terme de recherche</p>
                </div>
            )}
        </div>
    );
}
