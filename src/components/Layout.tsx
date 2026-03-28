import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Package,
  DollarSign,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function Layout({ children, currentPage, onNavigate, onLogout }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'products', label: 'Cabinets', icon: Package },
    { id: 'prices', label: 'Price List', icon: DollarSign },
  ];

  function handleNavigate(page: string) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-bg">
      <nav className="sticky top-0 z-50 glass-nav shadow-sm" style={{ borderRadius: 0 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center w-40">
              <button onClick={() => handleNavigate('dashboard')} className="flex items-center">
                <img
                  src="/evita_logo.png"
                  alt="Evita Cabinets"
                  className="h-8 w-auto object-contain"
                  style={{ filter: 'brightness(0) saturate(100%) invert(20%) sepia(80%) saturate(700%) hue-rotate(200deg)' }}
                />
              </button>
            </div>

            {/* Centered Nav */}
            <div className="flex-1 hidden lg:flex items-center justify-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Right actions */}
            <div className="flex-shrink-0 flex items-center gap-1 w-40 justify-end ml-auto lg:ml-0">
              <button
                onClick={() => handleNavigate('settings')}
                className={`hidden sm:inline-flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  currentPage === 'settings'
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>

              <button
                onClick={onLogout}
                className="hidden sm:inline-flex items-center justify-center p-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-150"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-150"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="lg:hidden border-t border-slate-200"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <div className="px-3 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200 mt-1">
                <button
                  onClick={() => handleNavigate('settings')}
                  className={`flex items-center justify-center p-3 rounded-lg transition-all duration-150 ${
                    currentPage === 'settings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title="Settings"
                >
                  <SettingsIcon className="h-5 w-5 flex-shrink-0" />
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center p-3 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all duration-150"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5 flex-shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
