import { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import type { TemplateCategory } from '../types';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, category: string) => Promise<void>;
  defaultName?: string;
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Base Cabinets',
  'Wall Cabinets',
  'Tall Cabinets',
  'Specialty',
  'Accessories',
  'General',
];

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  defaultName = '',
}: SaveTemplateModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setSaving(true);
      await onSave(name.trim(), description.trim(), category);
      setName('');
      setDescription('');
      setCategory('General');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setName('');
      setDescription('');
      setCategory('General');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Save as Template" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-status-red-bg border border-status-red-brd rounded-lg p-3">
            <p className="text-sm text-status-red-fg">{error}</p>
          </div>
        )}

        <Input
          label="Template Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Standard Base Cabinet - White"
          required
          disabled={saving}
        />

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">
            Description <span className="text-fg-500">(Optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes about this template..."
            rows={3}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus disabled:bg-surf-app"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={saving}
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus disabled:bg-surf-app"
          >
            {TEMPLATE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-accent-tint-soft border border-accent-tint-border rounded-lg p-3">
          <p className="text-sm text-accent-text">
            This cabinet configuration will be saved as a reusable template. You can apply it to any
            area in any project. The quantity will be set when you load the template.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
