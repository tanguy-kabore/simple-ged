import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentView from './pages/DocumentView';
import Folders from './pages/Folders';
import FolderView from './pages/FolderView';
import Users from './pages/Users';
import Workflows from './pages/Workflows';
import MyTasks from './pages/MyTasks';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Search from './pages/Search';
import ActivityLogs from './pages/ActivityLogs';

// Route protégée
function PrivateRoute({ children, roles }) {
    const { user, loading } = useAuth();
    
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }
    
    if (!user) {
        return <Navigate to="/login" />;
    }
    
    if (roles && !roles.includes(user.role)) {
        return <Navigate to="/dashboard" />;
    }
    
    return children;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster 
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: '#fff',
                            color: '#333',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            borderRadius: '8px',
                            padding: '12px 16px',
                        },
                        success: {
                            iconTheme: { primary: '#10B981', secondary: '#fff' }
                        },
                        error: {
                            iconTheme: { primary: '#EF4444', secondary: '#fff' }
                        }
                    }}
                />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    <Route path="/" element={
                        <PrivateRoute>
                            <MainLayout />
                        </PrivateRoute>
                    }>
                        <Route index element={<Navigate to="/dashboard" />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="documents" element={<Documents />} />
                        <Route path="documents/:id" element={<DocumentView />} />
                        <Route path="folders" element={<Folders />} />
                        <Route path="folders/:id" element={<FolderView />} />
                        <Route path="search" element={<Search />} />
                        <Route path="tasks" element={<MyTasks />} />
                        <Route path="workflows" element={
                            <PrivateRoute roles={['admin', 'manager']}>
                                <Workflows />
                            </PrivateRoute>
                        } />
                        <Route path="users" element={
                            <PrivateRoute roles={['admin', 'manager']}>
                                <Users />
                            </PrivateRoute>
                        } />
                        <Route path="activity" element={
                            <PrivateRoute roles={['admin']}>
                                <ActivityLogs />
                            </PrivateRoute>
                        } />
                        <Route path="settings" element={
                            <PrivateRoute roles={['admin']}>
                                <Settings />
                            </PrivateRoute>
                        } />
                        <Route path="profile" element={<Profile />} />
                    </Route>
                    
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
