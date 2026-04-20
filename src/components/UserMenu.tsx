import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronUp, LogOut, Settings as SettingsIcon, User, Languages } from 'lucide-react';
import { useCurrentMember } from '../lib/useCurrentMember';
import { useLocaleStore } from '../lib/localeStore';
import { getAvatarGradientStyle, getInitials } from '../lib/avatarColors';

interface UserMenuProps {
  expanded: boolean;
  onLogout: () => void;
}

export function UserMenu({ expanded, onLogout }: UserMenuProps) {
  const { member } = useCurrentMember();
  const { locale, toggle: toggleLocale } = useLocaleStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const name = member?.name ?? 'Loading…';
  const role = member?.job_title ?? member?.role ?? '';
  const initials = getInitials(member?.name);
  const gradient = getAvatarGradientStyle(member?.name);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.top - 8,
      left: rect.right + 8,
    });
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className={`group w-full flex items-center gap-2.5 rounded-xl p-1.5 text-left transition-all duration-150 hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          expanded ? '' : 'justify-center'
        }`}
      >
        <span
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
          style={gradient}
        >
          {initials}
        </span>
        {expanded && (
          <>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-slate-900 truncate">
                {name}
              </span>
              {role && (
                <span className="block text-[11px] text-slate-500 truncate capitalize">
                  {role}
                </span>
              )}
            </span>
            <ChevronUp
              className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${
                open ? '' : 'rotate-180'
              }`}
            />
          </>
        )}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] glass-white min-w-[220px] p-1.5 animate-slide-in-right"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="px-2.5 py-2 border-b border-slate-200/60">
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {name}
            </div>
            {member?.email && (
              <div className="text-[11px] text-slate-500 truncate">
                {member.email}
              </div>
            )}
          </div>
          <div className="py-1">
            <MenuButton disabled icon={User} label="Profile" />
            <MenuLink
              to="/settings"
              icon={SettingsIcon}
              label="Settings"
              onClick={() => setOpen(false)}
            />
            <MenuButton
              icon={Languages}
              label={locale === 'es' ? 'English' : 'Español'}
              rightText={locale.toUpperCase()}
              onClick={() => {
                toggleLocale();
              }}
            />
          </div>
          <div className="border-t border-slate-200/60 pt-1">
            <MenuButton
              icon={LogOut}
              label="Log out"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              danger
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function MenuLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: typeof User;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition-colors"
    >
      <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  rightText,
  disabled,
  danger,
}: {
  icon: typeof User;
  label: string;
  onClick?: () => void;
  rightText?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
        disabled
          ? 'text-slate-400 cursor-not-allowed'
          : danger
          ? 'text-rose-600 hover:bg-rose-50'
          : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
      }`}
    >
      <Icon
        className={`h-4 w-4 ${danger ? 'text-rose-500' : 'text-slate-400'}`}
        strokeWidth={1.75}
      />
      <span className="flex-1 text-left">{label}</span>
      {rightText && (
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {rightText}
        </span>
      )}
    </button>
  );
}
