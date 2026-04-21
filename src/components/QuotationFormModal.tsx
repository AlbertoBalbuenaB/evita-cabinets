import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import type { Project, Quotation, QuotationStatus } from '../types';

const STATUSES: QuotationStatus[] = [
  'Estimating',
  'Pending',
  'Sent',
  'Awarded',
  'Lost',
  'Discarded',
  'Cancelled',
];

interface QuotationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  project: Project;
  nextVersion: number;
  quotation?: Quotation;
  onSuccess: (id: string) => void;
}

export function QuotationFormModal({
  isOpen,
  onClose,
  projectId,
  project,
  nextVersion,
  quotation,
  onSuccess,
}: QuotationFormModalProps) {
  const isEditing = !!quotation;

  const [versionLabel, setVersionLabel] = useState('');
  const [status, setStatus] = useState<QuotationStatus>('Estimating');
  const [quoteDate, setQuoteDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVersionLabel(quotation?.version_label ?? `v${nextVersion}`);
      setStatus((quotation?.status as QuotationStatus) ?? 'Estimating');
      setQuoteDate(quotation?.quote_date ?? new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen, quotation, nextVersion]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!versionLabel.trim()) {
      setError('Quotation label is required');
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('quotations')
          .update({
            version_label: versionLabel.trim(),
            name: `${project.name} - ${versionLabel.trim()}`,
            status,
            quote_date: quoteDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', quotation.id);

        if (updateError) throw updateError;
        onSuccess(quotation.id);
      } else {
        const { data, error: insertError } = await supabase
          .from('quotations')
          .insert({
            project_id: projectId,
            name: `${project.name} - ${versionLabel.trim()}`,
            version_label: versionLabel.trim(),
            version_number: nextVersion,
            status,
            quote_date: quoteDate,
            project_type: project.project_type || 'Custom',
            customer: project.customer,
            address: project.address,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        if (data) onSuccess(data.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Quotation' : 'New Quotation'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <Input
          label='Label (e.g., "Plus", "Premium", "v2")'
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          placeholder="v1"
          required
          disabled={saving}
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as QuotationStatus)}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus disabled:bg-surf-app"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Date</label>
          <input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus disabled:bg-surf-app"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
