import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
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
const SupplierPage = lazy(() => import('./pages/SupplierPage').then(m => ({ default: m.SupplierPage })));
const ToolsHub = lazy(() => import('./pages/ToolsHub').then(m => ({ default: m.ToolsHub })));
const TakeoffPage = lazy(() => import('./pages/TakeoffPage').then(m => ({ default: m.TakeoffPage })));
const DraftToolPage = lazy(() => import('./tools/draft/DraftToolPage').then(m => ({ default: m.DraftToolPage })));
const KbHub = lazy(() => import('./pages/kb/KbHub').then(m => ({ default: m.KbHub })));
const KbEntryPage = lazy(() => import('./pages/kb/KbEntryPage').then(m => ({ default: m.KbEntryPage })));
const KbNew = lazy(() => import('./pages/kb/KbNew').then(m => ({ default: m.KbNew })));
const KbProposals = lazy(() => import('./pages/kb/KbProposals').then(m => ({ default: m.KbProposals })));
const KbProposalPage = lazy(() => import('./pages/kb/KbProposalPage').then(m => ({ default: m.KbProposalPage })));
const KbSupplierPage = lazy(() => import('./pages/kb/KbSupplierPage').then(m => ({ default: m.KbSupplierPage })));
const KbAudit = lazy(() => import('./pages/kb/KbAudit').then(m => ({ default: m.KbAudit })));
const WikiHub = lazy(() => import('./pages/wiki/WikiHub').then(m => ({ default: m.WikiHub })));
const WikiArticlePage = lazy(() => import('./pages/wiki/WikiArticlePage').then(m => ({ default: m.WikiArticlePage })));
const WikiNew = lazy(() => import('./pages/wiki/WikiNew').then(m => ({ default: m.WikiNew })));
const WikiProposals = lazy(() => import('./pages/wiki/WikiProposals').then(m => ({ default: m.WikiProposals })));
const WikiProposalPage = lazy(() => import('./pages/wiki/WikiProposalPage').then(m => ({ default: m.WikiProposalPage })));
const WikiAudit = lazy(() => import('./pages/wiki/WikiAudit').then(m => ({ default: m.WikiAudit })));

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
        <ErrorBoundary>
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
            <Route path="/tools" element={<ToolsHub />} />
            <Route path="/tools/takeoff" element={<TakeoffPage />} />
            <Route path="/tools/plan-viewer" element={<Navigate to="/tools/takeoff" replace />} />
            <Route path="/tools/draft" element={<DraftToolPage />} />
            <Route path="/suppliers/:id" element={<SupplierPage />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/kb/new" element={<KbNew />} />
            <Route path="/kb/audit" element={<AdminRoute><KbAudit /></AdminRoute>} />
            <Route path="/kb/proposals/:id" element={<KbProposalPage />} />
            <Route path="/kb/proposals" element={<KbProposals />} />
            <Route path="/kb/suppliers/:slug" element={<KbSupplierPage />} />
            <Route path="/kb/:slug" element={<KbEntryPage />} />
            <Route path="/kb" element={<KbHub />} />
            <Route path="/wiki/new" element={<WikiNew />} />
            <Route path="/wiki/audit" element={<AdminRoute><WikiAudit /></AdminRoute>} />
            <Route path="/wiki/proposals/:id" element={<WikiProposalPage />} />
            <Route path="/wiki/proposals" element={<WikiProposals />} />
            <Route path="/wiki/:slug" element={<WikiArticlePage />} />
            <Route path="/wiki" element={<WikiHub />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </Layout>
      <Suspense fallback={null}>
        <AiChat />
      </Suspense>
    </>
  );
}

export default App;
