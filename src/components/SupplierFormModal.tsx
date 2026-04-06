import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import type { Supplier, SupplierInsert, SupplierUpdate } from '../types';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier?: Supplier | null;
}

interface FormState {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  payment_terms: string;
  lead_time_days: string;
  notes: string;
  is_active: boolean;
}

function getDefaultForm(supplier?: Supplier | null): FormState {
  return {
    name: supplier?.name ?? '',
    contact_name: supplier?.contact_name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    website: supplier?.website ?? '',
    payment_terms: supplier?.payment_terms ?? '',
    lead_time_days: supplier?.lead_time_days != null ? String(supplier.lead_time_days) : '',
    notes: supplier?.notes ?? '',
    is_active: supplier?.is_active ?? true,
  };
}

export function SupplierFormModal({ isOpen, onClose, onSuccess, supplier }: SupplierFormModalProps) {
  const [form, setForm] = useState<FormState>(getDefaultForm(supplier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!supplier;

  useEffect(() => {
    if (isOpen) {
      setForm(getDefaultForm(supplier));
      setError(null);
    }
  }, [isOpen, supplier]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    setSaving(true);
    try {
      const leadTime = form.lead_time_days.trim() !== '' ? parseInt(form.lead_time_days, 10) : null;

      if (isEditing) {
        const update: SupplierUpdate = {
          name: form.name.trim(),
          contact_name: form.contact_name.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
          payment_terms: form.payment_terms.trim() || null,
          lead_time_days: leadTime,
          notes: form.notes.trim() || null,
          is_active: form.is_active,
        };
        const { error: err } = await supabase
          .from('suppliers')
          .update(update)
          .eq('id', supplier!.id);
        if (err) throw err;
      } else {
        const insert: SupplierInsert = {
          name: form.name.trim(),
          contact_name: form.contact_name.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
          payment_terms: form.payment_terms.trim() || null,
          lead_time_days: leadTime,
          notes: form.notes.trim() || null,
        };
        const { error: err } = await supabase.from('suppliers').insert(insert);
        if (err) throw err;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Supplier' : 'New Supplier'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Name *"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Hafele, Blum, Richelieu"
          disabled={saving}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Contact Name"
            value={form.contact_name}
            onChange={(e) => set('contact_name', e.target.value)}
            placeholder="Sales representative name"
            disabled={saving}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 (555) 000-0000"
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="orders@supplier.com"
            disabled={saving}
          />
          <Input
            label="Website"
            type="url"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://supplier.com"
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Payment Terms"
            value={form.payment_terms}
            onChange={(e) => set('payment_terms', e.target.value)}
            placeholder="e.g. Net 30, On delivery"
            disabled={saving}
          />
          <Input
            label="Lead Time (days)"
            type="number"
            min={0}
            value={form.lead_time_days}
            onChange={(e) => set('lead_time_days', e.target.value)}
            placeholder="e.g. 14"
            disabled={saving}
          />
        </div>

        <div className="w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Additional notes about this supplier..."
            rows={3}
            disabled={saving}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 resize-none text-sm"
          />
        </div>

        {isEditing && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
