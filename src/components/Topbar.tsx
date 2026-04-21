import { Menu, Bell, Search, Loader2 } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
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

  return (
    <header
      className="sticky top-0 z-30 bg-surf-chrome border-b border-border-hair"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3 h-14 px-3 sm:px-6 lg:px-8">
        <button
          onClick={openMobile}
          className="lg:hidden h-9 w-9 rounded-lg text-fg-500 hover:text-fg-700 hover:bg-surf-hover inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
          <ThemeToggle />
          <button
            onClick={onToggleNotifications}
            aria-label="Notifications"
            className="relative h-9 w-9 rounded-lg text-fg-500 hover:text-fg-700 hover:bg-surf-hover inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-dot ring-2 ring-surf-chrome" />
            )}
          </button>
        </div>
      </div>

      {hasTabs && (
        <div className="lg:hidden px-3 sm:px-6 py-1.5 overflow-x-auto scrollbar-none border-t border-border-hair">
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
                ? 'bg-seg-active-bg text-seg-active-fg font-semibold shadow-seg-active border border-border-soft'
                : 'text-fg-500 hover:text-fg-800 hover:bg-surf-btn-hover'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-[10px] font-bold leading-none px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-accent-badge-bg text-accent-badge-fg'
                    : 'bg-surf-muted text-fg-500'
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
    'h-9 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 px-3 sm:px-4 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
  const variant = isDanger
    ? 'bg-red-dot hover:brightness-110 text-white'
    : isSecondary
    ? 'bg-surf-btn hover:bg-surf-btn-hover text-fg-800 border border-border-soft'
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
        className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-lg bg-surf-btn hover:bg-surf-btn-hover border border-border-soft text-fg-400 text-[13px] transition-all min-w-[220px] lg:min-w-[260px] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
        <span className="flex-1 text-left">Search everywhere…</span>
        <kbd className="px-1.5 py-0.5 rounded-md bg-kbd-bg border border-border-soft text-[10px] font-semibold text-kbd-fg leading-none">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={onOpen}
        aria-label="Search"
        className="sm:hidden h-9 w-9 rounded-lg text-fg-500 hover:text-fg-700 hover:bg-surf-hover inline-flex items-center justify-center"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </>
  );
}
