import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProductsCatalog } from './pages/ProductsCatalog';
import { ProductItem } from './pages/ProductItem';
import { PriceList } from './pages/PriceList';
import { PriceListItem } from './pages/PriceListItem';
import { ProjectsHub } from './pages/ProjectsHub';
import { ProjectPage } from './pages/ProjectPage';
import { QuotationDetailsPage } from './pages/QuotationDetailsPage';
import { Templates } from './pages/Templates';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { AiChat } from './components/AiChat';
import { OptimizerPage } from './pages/OptimizerPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

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
    navigate('/');
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

  return (
    <>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectsHub />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/quotations/:quotationId" element={<QuotationDetailsPage />} />
          <Route path="/products/:id" element={<ProductItem />} />
          <Route path="/products" element={<ProductsCatalog />} />
          <Route path="/prices/:id" element={<PriceListItem />} />
          <Route path="/prices" element={<PriceList />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/optimizer" element={<OptimizerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <AiChat />
    </>
  );
}

export default App;
