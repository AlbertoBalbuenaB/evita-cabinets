import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { Login } from './pages/Login';
import { useAuth } from './lib/auth';
import { useCurrentMember } from './lib/useCurrentMember';

// ── Lazy-loaded pages (code-split per route) ────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectsHub = lazy(() => import('./pages/ProjectsHub').then(m => ({ default: m.ProjectsHub })));
const ProjectPage = lazy(() => import('./pages/ProjectPage').then(m => ({ default: m.ProjectPage })));
const QuotationDetailsPage = lazy(() => import('./pages/QuotationDetailsPage').then(m => ({ default: m.QuotationDetailsPage })));
const ProductsCatalog = lazy(() => import('./pages/ProductsCatalog').then(m => ({ default: m.ProductsCatalog })));
const ProductItem = lazy(() => import('./pages/ProductItem').then(m => ({ default: m.ProductItem })));
const PriceList = lazy(() => import('./pages/PriceList').then(m => ({ default: m.PriceList })));
const PriceListItem = lazy(() => import('./pages/PriceListItem').then(m => ({ default: m.PriceListItem })));
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const OptimizerPage = lazy(() => import('./pages/OptimizerPage').then(m => ({ default: m.OptimizerPage })));
const AiChat = lazy(() => import('./components/AiChat').then(m => ({ default: m.AiChat })));
const Suppliers = lazy(() => import('./pages/Suppliers').then(m => ({ default: m.Suppliers })));

function AdminRoute({ children }: { children: ReactNode }) {
  const { member, loading } = useCurrentMember();
  if (loading) return <PageLoader />;
  if (member?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="space-y-5 page-enter">
      <div className="glass-indigo rounded-2xl h-24 animate-pulse" />
      <div className="glass-white rounded-2xl h-12 animate-pulse" />
      <div className="glass-white rounded-2xl h-64 animate-pulse" />
    </div>
  );
}

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
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
            <Route path="/optimizer" element={<OptimizerPage />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      <Suspense fallback={null}>
        <AiChat />
      </Suspense>
    </>
  );
}

export default App;
