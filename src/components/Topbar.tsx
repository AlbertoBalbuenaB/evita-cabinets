import { Menu, Bell, Search, Loader2 } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { useSidebar } from '../hooks/useSidebar';
import { useChromeReader } from '../contexts/PageChromeContext';
import type { ChromeAction, ChromeTab } from '../contexts/PageChromeContext';

interface TopbarProps {
  onOpenSearch: () => void;
  onToggleNotifications: () => void;
  unreadCount: number;
}

export function Topbar({
  onOpenSearch,
  onToggleNotifications,
  unreadCount,
}: TopbarProps) {
  const { openMobile } = useSidebar();
  const { primaryAction, tabs, activeTabId } = useChromeReader();
  const hasTabs = !!tabs && tabs.length > 0;

  const topbarBg: React.CSSProperties = {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  };

  return (
    <header className="sticky top-0 z-30" style={topbarBg}>
      <div className="flex items-center gap-2 sm:gap-3 h-14 px-3 sm:px-6 lg:px-8">
        <button
          onClick={openMobile}
          className="lg:hidden h-9 w-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="min-w-0 shrink flex-initial">
          <Breadcrumbs />
        </div>

        {hasTabs && (
          <div className="hidden lg:block min-w-0 overflow-x-auto scrollbar-none">
            <TopbarTabs tabs={tabs!} activeTabId={activeTabId} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {primaryAction && <PrimaryActionButton action={primaryAction} />}
          <SearchPill onOpen={onOpenSearch} />
          <button
            onClick={onToggleNotifications}
            aria-label="Notifications"
            className="relative h-9 w-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {hasTabs && (
        <div
          className="lg:hidden px-3 sm:px-6 py-1.5 overflow-x-auto scrollbar-none"
          style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}
        >
          <TopbarTabs tabs={tabs!} activeTabId={activeTabId} />
        </div>
      )}
    </header>
  );
}

function TopbarTabs({
  tabs,
  activeTabId,
}: {
  tabs: ChromeTab[];
  activeTabId?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={tab.onClick}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] transition-colors whitespace-nowrap ${
              active
                ? 'bg-white text-slate-900 font-semibold shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-[10px] font-bold leading-none px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryActionButton({ action }: { action: ChromeAction }) {
  const Icon = action.icon;
  const isDanger = action.variant === 'danger';
  const isSecondary = action.variant === 'secondary';
  const base =
    'h-9 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 px-3 sm:px-4 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const variant = isDanger
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : isSecondary
    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
    : 'btn-primary-glass hover:brightness-105';
  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={`${base} ${variant}`}
    >
      {action.loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" strokeWidth={2} />
      ) : null}
      <span className="hidden sm:inline">{action.label}</span>
    </button>
  );
}

function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <button
        onClick={onOpen}
        aria-label="Search"
        className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-lg bg-white/60 hover:bg-white/80 border border-slate-200/60 text-slate-400 text-[13px] transition-all min-w-[220px] lg:min-w-[260px] focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
        <span className="flex-1 text-left">Search everywhere…</span>
        <kbd className="px-1.5 py-0.5 rounded-md bg-white/80 border border-slate-200/70 text-[10px] font-semibold text-slate-500 leading-none">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={onOpen}
        aria-label="Search"
        className="sm:hidden h-9 w-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </>
  );
}
