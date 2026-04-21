import { useState, useEffect } from 'react';
import { Star, X, Tag, ChevronDown } from 'lucide-react';
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
  logo_url: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  categories: string[];
  quality_score: number | null;
  punctuality: string;
  last_evaluation_date: string;
  payment_terms: string;
  lead_time_days: string;
  delivery_terms: string;
  special_discounts: string;
  min_purchase_amount: string;
  notes: string;
  is_active: boolean;
}

function getDefaultForm(supplier?: Supplier | null): FormState {
  return {
    name: supplier?.name ?? '',
    logo_url: supplier?.logo_url ?? '',
    contact_name: supplier?.contact_name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    website: supplier?.website ?? '',
    address: supplier?.address ?? '',
    categories: supplier?.categories ?? [],
    quality_score: supplier?.quality_score ?? null,
    punctuality: supplier?.punctuality ?? '',
    last_evaluation_date: supplier?.last_evaluation_date ?? '',
    payment_terms: supplier?.payment_terms ?? '',
    lead_time_days: supplier?.lead_time_days != null ? String(supplier.lead_time_days) : '',
    delivery_terms: supplier?.delivery_terms ?? '',
    special_discounts: supplier?.special_discounts ?? '',
    min_purchase_amount: supplier?.min_purchase_amount != null ? String(supplier.min_purchase_amount) : '',
    notes: supplier?.notes ?? '',
    is_active: supplier?.is_active ?? true,
  };
}

// ── Section divider ──────────────────────────────────────────────────────────

function FormSection({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold text-fg-400 uppercase tracking-wider whitespace-nowrap">{title}</span>
      <div className="flex-1 h-px bg-surf-muted" />
    </div>
  );
}

// ── Star selector ─────────────────────────────────────────────────────────────

function StarSelector({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(value === i ? null : i)}
            className="p-0.5 transition-transform hover:scale-110"
            title={`Quality score: ${i}`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                value != null && i <= value
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-fg-400 fill-slate-200 hover:text-amber-300 hover:fill-amber-300'
              }`}
            />
          </button>
        ))}
      </div>
      {value != null && (
        <span className="text-sm text-fg-500">{value}/5</span>
      )}
    </div>
  );
}

// ── Category picker ───────────────────────────────────────────────────────────

function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (cats: string[]) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    supabase.from('custom_types').select('type_name').order('type_name').then(({ data }) => {
      if (data) setOptions(data.map((d) => d.type_name));
    });
  }, []);

  function toggle(cat: string) {
    onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat]);
  }

  function remove(cat: string) {
    onChange(selected.filter((c) => c !== cat));
  }

  const filtered = options.filter(
    (o) => o.toLowerCase().includes(inputValue.toLowerCase()) && !selected.includes(o)
  );

  return (
    <div>
      <label className="block text-sm font-medium text-fg-700 mb-1">Categories</label>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-accent-tint-soft text-accent-text"
            >
              <Tag className="h-3 w-3" />
              {cat}
              <button
                type="button"
                onClick={() => remove(cat)}
                className="ml-0.5 text-blue-500 hover:text-accent-text transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-border-solid rounded-lg text-sm text-fg-500 bg-surf-card hover:border-slate-400 focus:outline-none focus:ring-2 focus-visible:ring-focus transition-colors"
        >
          <span>{selected.length > 0 ? `${selected.length} selected` : 'Add categories…'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-surf-card border border-border-soft rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border-soft">
              <input
                type="text"
                placeholder="Search types…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-border-soft rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-fg-400 px-3 py-2">No types found.</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { toggle(opt); setInputValue(''); }}
                    className="w-full text-left px-3 py-2 text-sm text-fg-700 hover:bg-accent-tint-soft hover:text-accent-text rounded-lg transition-colors"
                  >
                    {opt}
                  </button>
                ))
              )}
            </div>
            <div className="p-2 border-t border-border-soft">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full text-center text-xs text-fg-400 hover:text-fg-600 py-1"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-fg-400">Types are managed in Inventory settings.</p>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

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

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
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
      const minPurchase = form.min_purchase_amount.trim() !== '' ? parseFloat(form.min_purchase_amount) : null;

      const payload = {
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        categories: form.categories.length > 0 ? form.categories : [],
        quality_score: form.quality_score,
        punctuality: form.punctuality || null,
        last_evaluation_date: form.last_evaluation_date || null,
        payment_terms: form.payment_terms.trim() || null,
        lead_time_days: leadTime,
        delivery_terms: form.delivery_terms.trim() || null,
        special_discounts: form.special_discounts.trim() || null,
        min_purchase_amount: minPurchase,
        notes: form.notes.trim() || null,
      };

      if (isEditing) {
        const update: SupplierUpdate = { ...payload, is_active: form.is_active };
        const { error: err } = await supabase.from('suppliers').update(update).eq('id', supplier!.id);
        if (err) throw err;
      } else {
        const insert: SupplierInsert = { ...payload };
        const { error: err } = await supabase.from('suppliers').insert(insert);
        if (err) throw err;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Supplier' : 'New Supplier'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-status-red-bg border border-status-red-brd px-4 py-3 text-sm text-status-red-fg">
            {error}
          </div>
        )}

        {/* ── Section 1: Basic Info ── */}
        <FormSection title="Basic Info" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Hafele, Blum, Richelieu"
            disabled={saving}
            required
          />
          <div>
            <Input
              label="Logo URL"
              type="url"
              value={form.logo_url}
              onChange={(e) => set('logo_url', e.target.value)}
              placeholder="https://example.com/logo.png"
              disabled={saving}
            />
            {form.logo_url.trim() && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg border border-border-soft bg-surf-card flex items-center justify-center overflow-hidden">
                  <img
                    src={form.logo_url.trim()}
                    alt="Logo preview"
                    className="w-full h-full object-contain p-0.5"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <span className="text-xs text-fg-400">Preview</span>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-border-solid text-accent-text focus-visible:ring-focus"
            />
            <span className="text-sm font-medium text-fg-700">Active</span>
          </label>
        )}

        {/* ── Section 2: Contact Details ── */}
        <FormSection title="Contact Details" />

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
            placeholder="+52 (33) 1234-5678"
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

        {/* ── Section 3: Location ── */}
        <FormSection title="Location" />

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Full address, city, state. You can list multiple branches separated by lines."
            rows={2}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg shadow-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 disabled:bg-surf-app disabled:text-fg-500 resize-none text-sm"
          />
        </div>

        {/* ── Section 4: Categories ── */}
        <FormSection title="Categories" />

        <CategoryPicker
          selected={form.categories}
          onChange={(cats) => set('categories', cats)}
        />

        {/* ── Section 5: Evaluation ── */}
        <FormSection title="Supplier Evaluation" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-2">Quality Score</label>
            <StarSelector
              value={form.quality_score}
              onChange={(v) => set('quality_score', v)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-2">Punctuality</label>
            <div className="flex gap-2">
              {(['Alta', 'Media', 'Baja'] as const).map((p) => {
                const active = form.punctuality === p;
                const colors: Record<string, string> = {
                  Alta:  active ? 'bg-status-emerald-bg text-status-emerald-fg border-status-emerald-brd' : 'bg-surf-card text-fg-500 border-border-solid hover:border-status-emerald-brd',
                  Media: active ? 'bg-status-amber-bg text-status-amber-fg border-status-amber-brd' : 'bg-surf-card text-fg-500 border-border-solid hover:border-status-amber-brd',
                  Baja:  active ? 'bg-status-red-bg text-status-red-fg border-status-red-brd' : 'bg-surf-card text-fg-500 border-border-solid hover:border-status-red-brd',
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('punctuality', active ? '' : p)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${colors[p]}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Input
          label="Last Evaluation Date"
          type="date"
          value={form.last_evaluation_date}
          onChange={(e) => set('last_evaluation_date', e.target.value)}
          disabled={saving}
        />

        {/* ── Section 6: Commercial Terms ── */}
        <FormSection title="Commercial Terms" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Terms of Payment"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Delivery Terms"
            value={form.delivery_terms}
            onChange={(e) => set('delivery_terms', e.target.value)}
            placeholder="e.g. FOB, CIF, Ex-works"
            disabled={saving}
          />
          <Input
            label="Min. Purchase Amount"
            type="number"
            min={0}
            step="0.01"
            value={form.min_purchase_amount}
            onChange={(e) => set('min_purchase_amount', e.target.value)}
            placeholder="e.g. 500.00"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Special Discounts</label>
          <textarea
            value={form.special_discounts}
            onChange={(e) => set('special_discounts', e.target.value)}
            placeholder="Describe any volume discounts, promotional rates, or special agreements..."
            rows={2}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg shadow-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 disabled:bg-surf-app disabled:text-fg-500 resize-none text-sm"
          />
        </div>

        {/* ── Section 7: Notes ── */}
        <FormSection title="Notes" />

        <div>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Additional notes about this supplier..."
            rows={3}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg shadow-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 disabled:bg-surf-app disabled:text-fg-500 resize-none text-sm"
          />
        </div>

        {/* Actions */}
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
