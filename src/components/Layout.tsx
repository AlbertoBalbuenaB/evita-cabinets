import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Package,
  DollarSign,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X
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
    { id: 'products', label: 'Products Catalog', icon: Package },
    { id: 'prices', label: 'Price List', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  function handleNavigate(page: string) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => handleNavigate('dashboard')}
                className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity"
              >
                <img
                  src="/evita png (1).png"
                  alt="Evita Cabinets Logo"
                  className="h-10 w-auto"
                />
                <span className="ml-3 text-lg sm:text-xl font-semibold text-slate-900">
                  Quotation System
                </span>
              </button>
              <div className="hidden lg:ml-8 lg:flex lg:space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`inline-flex items-center px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onLogout}
                className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </button>

              <button
                onClick={onLogout}
                className="sm:hidden inline-flex items-center p-2 text-slate-600 hover:text-slate-900 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </button>
                );
              })}
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
