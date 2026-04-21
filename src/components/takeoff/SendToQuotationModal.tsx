import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import { sendToQuotation } from '../../lib/takeoff/sendToQuotation';
import type { MeasurementUnit } from '../../lib/takeoff/types';

interface QuotationOption {
  id: string;
  name: string;
  version_label: string | null;
  version_number: number | null;
}

interface AreaOption {
  id: string;
  name: string;
}

interface SendToQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;                 // projects.id — session must be linked to one
  displayUnit: MeasurementUnit;
}

export function SendToQuotationModal({ isOpen, onClose, projectId, displayUnit }: SendToQuotationModalProps) {
  const { measurements } = useTakeoffStore();
  const linkedCount = measurements.filter((m) => m.linkedProduct).length;

  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [quotationId, setQuotationId] = useState<string>('');
  const [areaId, setAreaId] = useState<string>('');
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load quotations for this project when modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setResult(null);
    setError(null);
    setQuotationsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select('id, name, version_label, version_number')
        .eq('project_id', projectId)
        .order('quote_date', { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      setQuotations((data ?? []) as QuotationOption[]);
      setQuotationId(((data ?? [])[0]?.id as string) ?? '');
      setQuotationsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen, projectId]);

  // When the quotation changes, reload its areas.
  useEffect(() => {
    if (!isOpen || !quotationId) { setAreas([]); setAreaId(''); return; }
    let cancelled = false;
    setAreasLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('project_areas')
        .select('id, name')
        .eq('project_id', quotationId) // quotations.id per the DB naming
        .order('display_order', { ascending: true });
      if (cancelled) return;
      if (error) setError(error.message);
      setAreas((data ?? []) as AreaOption[]);
      setAreaId(((data ?? [])[0]?.id as string) ?? '');
      setAreasLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen, quotationId]);

  const handleSend = async () => {
    if (!areaId) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendToQuotation({ measurements, areaId, displayUnit });
      setResult({ inserted: res.insertedCount, skipped: res.skippedCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send to quotation" size="md">
      <div className="space-y-3">
        <p className="text-xs text-fg-500">
          {linkedCount === 0
            ? 'Link measurements to price list items (via the link icon on a row) to send them here.'
            : `${linkedCount} linked measurement${linkedCount === 1 ? '' : 's'} will be inserted as line items in the destination area.`}
        </p>

        {/* Quotation */}
        <div>
          <label className="block text-xs font-medium text-fg-600 mb-1">Quotation</label>
          <select
            value={quotationId}
            onChange={(e) => setQuotationId(e.target.value)}
            disabled={quotationsLoading || sending}
            className="w-full text-sm border border-border-soft rounded-md px-2 py-1.5 bg-surf-card focus:outline-none focus:ring-1 focus-visible:ring-focus disabled:bg-surf-app"
          >
            {quotations.length === 0 && <option value="">No quotations in this project</option>}
            {quotations.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}{q.version_number ? ` · v${q.version_number}` : ''}{q.version_label ? ` · ${q.version_label}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Area */}
        <div>
          <label className="block text-xs font-medium text-fg-600 mb-1">Destination area</label>
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            disabled={!quotationId || areasLoading || sending}
            className="w-full text-sm border border-border-soft rounded-md px-2 py-1.5 bg-surf-card focus:outline-none focus:ring-1 focus-visible:ring-focus disabled:bg-surf-app"
          >
            {areas.length === 0 && <option value="">No areas — create one in the quotation first</option>}
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
            Inserted {result.inserted} item{result.inserted === 1 ? '' : 's'}
            {result.skipped > 0 && ` · skipped ${result.skipped}`}
            . Open the quotation to edit quantities.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              disabled={sending || !areaId || linkedCount === 0}
            >
              {sending ? (<><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Sending…</>) : 'Send'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
