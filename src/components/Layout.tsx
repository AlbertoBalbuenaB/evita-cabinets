import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';
import { NotificationPanel } from './NotificationPanel';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useNotifications } from '../lib/useNotifications';
import { useSidebar } from '../hooks/useSidebar';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

export function Layout({ children, onLogout }: LayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { expanded } = useSidebar();
  const { pathname } = useLocation();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isFullBleedRoute =
    pathname.startsWith('/optimizer') ||
    pathname.startsWith('/tools/takeoff') ||
    pathname.startsWith('/tools/plan-viewer') ||
    pathname.startsWith('/tools/draft');

  const rootStyle: CSSProperties = {
    ['--rail-w' as never]: expanded ? '220px' : '64px',
  };

  return (
    <div className="app-bg min-h-screen" style={rootStyle}>
      <Sidebar onLogout={onLogout} />
      <div className="min-h-screen flex flex-col transition-[margin-left] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] lg:ml-[var(--rail-w)]">
        <Topbar
          onOpenSearch={() => setSearchOpen(true)}
          onToggleNotifications={() => setNotifOpen((v) => !v)}
          unreadCount={unreadCount}
        />
        <main
          className={
            isFullBleedRoute
              ? 'flex-1 min-h-0'
              : 'flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'
          }
        >
          {children}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
