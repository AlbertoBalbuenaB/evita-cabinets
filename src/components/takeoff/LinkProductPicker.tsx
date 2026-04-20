import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Link2Off } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { supabase } from '../../lib/supabase';
import type { LinkedProduct } from '../../lib/takeoff/types';

interface PriceListRow {
  id: string;
  concept_description: string;
  sku_code: string | null;
  type: string | null;
  unit: string | null;
  price: number | null;
}

interface LinkProductPickerProps {
  isOpen: boolean;
  onClose: () => void;
  // The measurement being linked — shown as context in the header.
  measurementName: string;
  currentLink: LinkedProduct | null;
  onSave: (link: LinkedProduct | null) => void;
}

export function LinkProductPicker({ isOpen, onClose, measurementName, currentLink, onSave }: LinkProductPickerProps) {
  const [items, setItems] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase
        .from('price_list')
        .select('id, concept_description, sku_code, type, unit, price')
        .eq('is_active', true)
        .order('concept_description', { ascending: true })
        .limit(1000);
      if (cancelled) return;
      if (error) setError(error.message);
      setItems((data ?? []) as PriceListRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items
      .filter((r) =>
        r.concept_description.toLowerCase().includes(q) ||
        (r.sku_code ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [items, query]);

  const handlePick = (row: PriceListRow) => {
    onSave({
      kind: 'price_list',
      id: row.id,
      label: row.concept_description,
      unit: row.unit ?? undefined,
    });
    onClose();
  };

  const handleUnlink = () => {
    onSave(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Link product — ${measurementName}`} size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by description, SKU, or type…"
            className="w-full text-sm border border-slate-200 rounded-md pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {currentLink && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50/60 rounded-lg text-xs">
            <div className="min-w-0">
              <span className="font-medium text-blue-800">Currently linked:</span>
              <span className="ml-1 text-blue-700 truncate">{currentLink.label}</span>
            </div>
            <button
              onClick={handleUnlink}
              className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
            >
              <Link2Off className="h-3 w-3" />
              Unlink
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {loading ? (
          <div className="py-8 flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-sm text-slate-500 text-center">
            {query ? 'No matches.' : 'No active price list items.'}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => handlePick(r)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-800 font-medium truncate">{r.concept_description}</span>
                  {r.unit && <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 flex-shrink-0">{r.unit}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                  {r.sku_code && <span className="font-mono">{r.sku_code}</span>}
                  {r.type && <span>·  {r.type}</span>}
                  {r.price !== null && <span className="ml-auto">${r.price.toFixed(2)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
