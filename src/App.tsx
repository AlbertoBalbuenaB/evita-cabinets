import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProductsCatalog } from './pages/ProductsCatalog';
import { PriceList } from './pages/PriceList';
import { Projects } from './pages/Projects';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authStatus === 'true');
    setIsCheckingAuth(false);
  }, []);

  function handleLogin() {
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  function handleNavigateToProject(projectId: string) {
    setSelectedProjectId(projectId);
    setCurrentPage('projects');
  }

  function renderPage() {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} onNavigateToProject={handleNavigateToProject} />;
      case 'products':
        return <ProductsCatalog />;
      case 'prices':
        return <PriceList />;
      case 'projects':
        return <Projects selectedProjectId={selectedProjectId} onClearSelection={() => setSelectedProjectId(null)} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentPage} onNavigateToProject={handleNavigateToProject} />;
    }
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout}>
      {renderPage()}
    </Layout>
  );
}

export default App;
