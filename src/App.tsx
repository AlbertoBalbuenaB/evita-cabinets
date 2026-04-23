import { Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { Login } from './pages/Login';
import { useAuth } from './lib/auth';
import { useCurrentMember } from './lib/useCurrentMember';
import { PageChromeProvider } from './contexts/PageChromeContext';
import { lazyWithRetry } from './lib/lazyWithRetry';

// ── Lazy-loaded pages (code-split per route) ────────────────────────────────
// `lazyWithRetry` wraps `React.lazy` with a retry + hard-reload fallback so
// a stale chunk URL (common after a fresh deploy when the user had the tab
// open against the previous build) turns into a silent page refresh instead
// of a "Failed to fetch dynamically imported module" error card.
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectsHub = lazyWithRetry(() => import('./pages/ProjectsHub').then(m => ({ default: m.ProjectsHub })));
const ProjectPage = lazyWithRetry(() => import('./pages/ProjectPage').then(m => ({ default: m.ProjectPage })));
const QuotationDetailsPage = lazyWithRetry(() => import('./pages/QuotationDetailsPage').then(m => ({ default: m.QuotationDetailsPage })));
const ProductsCatalog = lazyWithRetry(() => import('./pages/ProductsCatalog').then(m => ({ default: m.ProductsCatalog })));
const ProductItem = lazyWithRetry(() => import('./pages/ProductItem').then(m => ({ default: m.ProductItem })));
const PriceList = lazyWithRetry(() => import('./pages/PriceList').then(m => ({ default: m.PriceList })));
const PriceListItem = lazyWithRetry(() => import('./pages/PriceListItem').then(m => ({ default: m.PriceListItem })));
const Templates = lazyWithRetry(() => import('./pages/Templates').then(m => ({ default: m.Templates })));
const Settings = lazyWithRetry(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const OptimizerPage = lazyWithRetry(() => import('./pages/OptimizerPage').then(m => ({ default: m.OptimizerPage })));
const AiChat = lazyWithRetry(() => import('./components/AiChat').then(m => ({ default: m.AiChat })));
const Suppliers = lazyWithRetry(() => import('./pages/Suppliers').then(m => ({ default: m.Suppliers })));
const SupplierPage = lazyWithRetry(() => import('./pages/SupplierPage').then(m => ({ default: m.SupplierPage })));
const ToolsHub = lazyWithRetry(() => import('./pages/ToolsHub').then(m => ({ default: m.ToolsHub })));
const TakeoffPage = lazyWithRetry(() => import('./pages/TakeoffPage').then(m => ({ default: m.TakeoffPage })));
const DraftToolPage = lazyWithRetry(() => import('./tools/draft/DraftToolPage').then(m => ({ default: m.DraftToolPage })));
const KbHub = lazyWithRetry(() => import('./pages/kb/KbHub').then(m => ({ default: m.KbHub })));
const KbEntryPage = lazyWithRetry(() => import('./pages/kb/KbEntryPage').then(m => ({ default: m.KbEntryPage })));
const KbNew = lazyWithRetry(() => import('./pages/kb/KbNew').then(m => ({ default: m.KbNew })));
const KbProposals = lazyWithRetry(() => import('./pages/kb/KbProposals').then(m => ({ default: m.KbProposals })));
const KbProposalPage = lazyWithRetry(() => import('./pages/kb/KbProposalPage').then(m => ({ default: m.KbProposalPage })));
const KbSupplierPage = lazyWithRetry(() => import('./pages/kb/KbSupplierPage').then(m => ({ default: m.KbSupplierPage })));
const KbAudit = lazyWithRetry(() => import('./pages/kb/KbAudit').then(m => ({ default: m.KbAudit })));
const WikiHub = lazyWithRetry(() => import('./pages/wiki/WikiHub').then(m => ({ default: m.WikiHub })));
const WikiArticlePage = lazyWithRetry(() => import('./pages/wiki/WikiArticlePage').then(m => ({ default: m.WikiArticlePage })));
const WikiNew = lazyWithRetry(() => import('./pages/wiki/WikiNew').then(m => ({ default: m.WikiNew })));
const WikiProposals = lazyWithRetry(() => import('./pages/wiki/WikiProposals').then(m => ({ default: m.WikiProposals })));
const WikiProposalPage = lazyWithRetry(() => import('./pages/wiki/WikiProposalPage').then(m => ({ default: m.WikiProposalPage })));
const WikiAudit = lazyWithRetry(() => import('./pages/wiki/WikiAudit').then(m => ({ default: m.WikiAudit })));
const CrmPlaceholder = lazyWithRetry(() => import('./pages/CrmPlaceholder').then(m => ({ default: m.CrmPlaceholder })));
const ProjectHeaderDemo = lazyWithRetry(() => import('./pages/_dev/ProjectHeaderDemo').then(m => ({ default: m.ProjectHeaderDemo })));

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
      <div className="min-h-screen flex items-center justify-center bg-surf-app">
        <div className="text-fg-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <PageChromeProvider>
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
            <Route path="/crm" element={<CrmPlaceholder />} />
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
            <Route path="/_dev/project-header" element={<ProjectHeaderDemo />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </Layout>
      <Suspense fallback={null}>
        <AiChat />
      </Suspense>
    </PageChromeProvider>
  );
}

export default App;
