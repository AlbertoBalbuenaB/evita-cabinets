import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { HomePage } from './pages/HomePage';
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
import { useAuth } from './lib/auth';

function App() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <>
      <Layout onLogout={signOut}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
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
