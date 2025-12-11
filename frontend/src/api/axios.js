import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 30000
});

// Intercepteur pour ajouter le token JWT à chaque requête
api.interceptors.request.use(
    (config) => {
        // Toujours lire le token frais depuis localStorage
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs de réponse
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Seulement rediriger vers login si 401 et pas déjà sur la page login
        if (error.response?.status === 401) {
            const isLoginPage = window.location.pathname === '/login';
            const isLoginRequest = error.config?.url?.includes('/auth/login');
            
            // Ne pas rediriger si c'est une requête de login ou si on est déjà sur la page login
            if (!isLoginPage && !isLoginRequest) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
