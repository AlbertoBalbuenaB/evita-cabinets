import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

const PROJECT_TYPES = ['Custom', 'Bids', 'Prefab', 'Stores'] as const;

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the project is created. Receives the new project id. */
  onSuccess?: (projectId: string) => void;
}

export function NewProjectModal({ isOpen, onClose, onSuccess }: NewProjectModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCustomer('');
      setAddress('');
      setProjectType('');
      setError(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setSaving(true);
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          customer: customer.trim() || null,
          address: address.trim() || null,
          project_type: projectType || null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error('No data returned');

      onClose();
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        navigate(`/projects/${data.id}`);
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith Kitchen Remodel"
            disabled={saving}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Customer</label>
          <Input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="e.g. John Smith"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Address</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Main St, Austin TX"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Project Type</label>
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-border-soft rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus bg-surf-card text-fg-700"
          >
            <option value="">— Select type —</option>
            {PROJECT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'Creating…' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
