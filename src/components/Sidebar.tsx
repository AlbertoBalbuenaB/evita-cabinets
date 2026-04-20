import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  FolderKanban,
  Warehouse,
  Package,
  Users,
  Wrench,
  BookOpen,
  Library,
  Settings as SettingsIcon,
  PanelLeftOpen,
  PanelLeftClose,
  type LucideIcon,
} from 'lucide-react';
import { useSidebar } from '../hooks/useSidebar';
import { useProjectsCount } from '../hooks/useProjectsCount';
import { useInventoryCount } from '../hooks/useInventoryCount';
import { UserMenu } from './UserMenu';

interface SidebarProps {
  onLogout: () => void;
}

type Item = {
  path: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  badge?: number | null;
  newBadge?: boolean;
};

export function Sidebar({ onLogout }: SidebarProps) {
  const { pathname } = useLocation();
  const { expanded, mobileOpen, closeMobile, toggleExpanded } = useSidebar();
  const projectsCount = useProjectsCount();
  const inventoryCount = useInventoryCount();

  // Close mobile drawer on route change
  useEffect(() => {
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close mobile drawer on Esc
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMobile();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  const workspace: Item[] = [
    { path: '/', icon: Home, label: 'Home', exact: true },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];
  const operations: Item[] = [
    { path: '/projects', icon: FolderKanban, label: 'Projects', badge: projectsCount },
    { path: '/prices', icon: Warehouse, label: 'Inventory', badge: inventoryCount },
    { path: '/products', icon: Package, label: 'Cabinets' },
    { path: '/crm', icon: Users, label: 'CRM', newBadge: true },
  ];
  const resources: Item[] = [
    { path: '/tools', icon: Wrench, label: 'Tools' },
    { path: '/kb', icon: BookOpen, label: 'KB' },
    { path: '/wiki', icon: Library, label: 'Wiki' },
  ];

  return (
    <>
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMobile}
        aria-hidden
      />
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          w-[220px] lg:w-[var(--rail-w)]
          transition-[transform,width] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '1px 0 12px rgba(99,102,241,0.06)',
        }}
      >
        <SidebarHeader expanded={expanded} onToggle={toggleExpanded} />

        <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-2.5 py-3 space-y-5">
          <GroupLabel expanded={expanded}>Workspace</GroupLabel>
          <ul className="space-y-0.5 -mt-1">
            {workspace.map((item) => (
              <RailItem key={item.path} item={item} expanded={expanded} />
            ))}
          </ul>

          <GroupLabel expanded={expanded}>Operations</GroupLabel>
          <ul className="space-y-0.5 -mt-1">
            {operations.map((item) => (
              <RailItem key={item.path} item={item} expanded={expanded} />
            ))}
          </ul>

          <GroupLabel expanded={expanded}>Resources</GroupLabel>
          <ul className="space-y-0.5 -mt-1">
            {resources.map((item) => (
              <RailItem key={item.path} item={item} expanded={expanded} />
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-slate-200/60 p-2.5 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                isActive
                  ? 'text-indigo-600 bg-indigo-50/60 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              } ${expanded ? '' : 'lg:justify-center'}`
            }
          >
            <SettingsIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className={expanded ? '' : 'lg:hidden'}>Settings</span>
          </NavLink>
          <UserMenu expanded={expanded} onLogout={onLogout} />
        </div>
      </aside>
    </>
  );
}

function SidebarHeader({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="shrink-0 h-14 flex items-center gap-2 px-3 border-b border-slate-200/50">
      <Link
        to="/"
        className="flex items-center gap-2 min-w-0"
        aria-label="Evita Cabinets home"
      >
        <span
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white text-[13px] font-bold"
          style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
        >
          E
        </span>
        <span
          className={`text-sm font-semibold text-slate-900 truncate ${
            expanded ? '' : 'lg:hidden'
          }`}
        >
          Evita Cabinets
        </span>
      </Link>
      <button
        onClick={onToggle}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={expanded}
        className={`hidden lg:inline-flex ml-auto h-7 w-7 rounded-md items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        {expanded ? (
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

function GroupLabel({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${
        expanded ? '' : 'lg:hidden'
      }`}
    >
      {children}
    </div>
  );
}

function RailItem({ item, expanded }: { item: Item; expanded: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.path}
        end={item.exact}
        aria-label={item.label}
        className={({ isActive }) =>
          `group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
            isActive
              ? 'bg-gradient-to-br from-indigo-500/[0.12] to-blue-500/[0.12] text-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
          } ${expanded ? '' : 'lg:justify-center'}`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-500 to-blue-500"
              />
            )}
            <Icon
              className="h-4 w-4 shrink-0"
              strokeWidth={isActive ? 2 : 1.75}
            />
            <span
              className={`flex-1 truncate ${expanded ? '' : 'lg:hidden'}`}
            >
              {item.label}
            </span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span
                className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-600 ${
                  expanded ? '' : 'lg:hidden'
                }`}
              >
                {item.badge}
              </span>
            )}
            {item.newBadge && (
              <span
                className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-400/90 text-amber-950 tracking-wider ${
                  expanded ? '' : 'lg:hidden'
                }`}
              >
                NEW
              </span>
            )}
            {/* Collapsed-state tooltip */}
            <span
              className={`hidden lg:group-hover:block absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap pointer-events-none z-50 shadow-lg ${
                expanded ? 'lg:hidden' : ''
              }`}
            >
              {item.label}
            </span>
          </>
        )}
      </NavLink>
    </li>
  );
}
