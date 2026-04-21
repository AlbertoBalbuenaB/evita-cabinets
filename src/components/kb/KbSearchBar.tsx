import { Search, X } from 'lucide-react';

interface KbSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function KbSearchBar({ value, onChange, placeholder }: KbSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search the Knowledge Base…'}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl glass-white border border-white/80 text-sm text-fg-800 placeholder:text-fg-400 focus:outline-none focus:ring-2 focus-visible:ring-focus/60"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-400 hover:text-fg-600"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
