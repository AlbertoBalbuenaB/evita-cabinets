import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FolderOpen,
  FileText,
  Package,
  DollarSign,
  Loader2,
  X,
  BookOpen,
  Building2,
  Library,
} from 'lucide-react';
import { useGlobalSearch, type SearchResult } from '../hooks/useGlobalSearch';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const CATEGORY_CONFIG = {
  projects: {
    label: 'Projects',
    icon: FolderOpen,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  quotations: {
    label: 'Quotations',
    icon: FileText,
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
  },
  cabinets: {
    label: 'Cabinets',
    icon: Package,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-50',
  },
  priceItems: {
    label: 'Price Items',
    icon: DollarSign,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-50',
  },
  kbEntries: {
    label: 'Knowledge Base',
    icon: BookOpen,
    iconColor: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
  },
  kbSuppliers: {
    label: 'Suppliers',
    icon: Building2,
    iconColor: 'text-teal-500',
    bgColor: 'bg-teal-50',
  },
  wikiArticles: {
    label: 'Wiki',
    icon: Library,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-50',
  },
} as const;

const RESULT_ICON: Record<SearchResult['type'], React.ElementType> = {
  project: FolderOpen,
  quotation: FileText,
  cabinet: Package,
  price_item: DollarSign,
  kb_entry: BookOpen,
  kb_supplier: Building2,
  wiki_article: Library,
};

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { query, setQuery, results, allResults, isLoading, hasResults, reset } =
    useGlobalSearch();
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Focus input when modal opens; reset on close
  useEffect(() => {
    if (open) {
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = allResults[activeIndex] ?? allResults[0];
      if (target) {
        navigate(target.url);
        onClose();
      }
    }
  }

  function handleResultClick(result: SearchResult) {
    navigate(result.url);
    onClose();
  }

  if (!open) return null;

  // Build ordered sections for rendering
  const sections = (
    ['projects', 'quotations', 'cabinets', 'priceItems', 'kbEntries', 'kbSuppliers', 'wikiArticles'] as const
  ).filter((key) => results[key].length > 0);

  // Compute flat index offset per section for activeIndex matching
  const sectionOffsets: Record<string, number> = {};
  let offset = 0;
  for (const key of ['projects', 'quotations', 'cabinets', 'priceItems', 'kbEntries', 'kbSuppliers', 'wikiArticles'] as const) {
    sectionOffsets[key] = offset;
    offset += results[key].length;
  }

  const showEmptyState = !isLoading && query.length >= 2 && !hasResults;
  const showPrompt = query.length < 2 && !isLoading;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4 pb-4"
      style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Modal panel */}
      <div
        className="w-full sm:max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, quotations, cabinets, prices…"
            className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-base"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {isLoading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
            {query.length > 0 && !isLoading && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                tabIndex={-1}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
              Esc
            </kbd>
          </div>
        </div>

        {/* Results area */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {/* Prompt state */}
          {showPrompt && (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Type at least 2 characters to search</p>
              <p className="text-xs mt-1 text-slate-300">
                Searches across Projects, Quotations, Cabinets &amp; Price Items
              </p>
            </div>
          )}

          {/* No results state */}
          {showEmptyState && (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No results for &ldquo;<span className="text-slate-600 font-medium">{query}</span>&rdquo;</p>
            </div>
          )}

          {/* Results grouped by category */}
          {hasResults &&
            sections.map((key) => {
              const config = CATEGORY_CONFIG[key];
              const items = results[key];
              const baseOffset = sectionOffsets[key];
              const CategoryIcon = config.icon;

              return (
                <div key={key}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <CategoryIcon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {config.label}
                    </span>
                    <span className="text-xs text-slate-300 ml-auto">{items.length}</span>
                  </div>

                  {/* Result items */}
                  {items.map((result, localIdx) => {
                    const flatIdx = baseOffset + localIdx;
                    const isActive = flatIdx === activeIndex;
                    const ResultIcon = RESULT_ICON[result.type];

                    return (
                      <button
                        key={result.id}
                        ref={isActive ? activeItemRef : undefined}
                        onClick={() => handleResultClick(result)}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        aria-selected={isActive}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg ${config.bgColor}`}
                        >
                          <ResultIcon className={`h-4 w-4 ${config.iconColor}`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                            {highlightMatch(result.title, query)}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {highlightMatch(result.subtitle, query)}
                            </p>
                          )}
                        </div>

                        {/* Badge */}
                        {result.badge && (
                          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${config.bgColor} ${config.iconColor}`}>
                            {result.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {/* Footer hint */}
          {hasResults && (
            <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 mt-1">
              <span className="text-xs text-slate-300 flex items-center gap-1">
                <kbd className="inline-flex items-center px-1 py-0.5 text-xs font-mono bg-slate-100 rounded border border-slate-200 text-slate-400">↑↓</kbd>
                navigate
              </span>
              <span className="text-xs text-slate-300 flex items-center gap-1">
                <kbd className="inline-flex items-center px-1 py-0.5 text-xs font-mono bg-slate-100 rounded border border-slate-200 text-slate-400">↵</kbd>
                open
              </span>
              <span className="text-xs text-slate-300 flex items-center gap-1">
                <kbd className="inline-flex items-center px-1 py-0.5 text-xs font-mono bg-slate-100 rounded border border-slate-200 text-slate-400">Esc</kbd>
                close
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
