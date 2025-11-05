import { useState, useEffect } from 'react';
import { GitBranch, Plus, Check, Copy, Trash2, History, GitCompare, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { Input } from './Input';
import {
  getProjectVersions,
  getCurrentVersion,
  createEmptyVersion,
  duplicateVersion,
  setCurrentVersion,
  deleteVersion,
} from '../lib/versioningSystem';
import type { ProjectVersion } from '../types/versioning';
import { formatCurrency } from '../lib/calculations';
import { format } from 'date-fns';

interface VersionManagerProps {
  projectId: string;
  onVersionChange: (versionId: string) => void;
  onCompare: (versionId1: string, versionId2: string) => void;
}

export function VersionManager({ projectId, onVersionChange, onCompare }: VersionManagerProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [currentVersion, setCurrentVersionState] = useState<ProjectVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [projectId]);

  async function loadVersions() {
    try {
      const [allVersions, current] = await Promise.all([
        getProjectVersions(projectId),
        getCurrentVersion(projectId),
      ]);
      setVersions(allVersions);
      setCurrentVersionState(current);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetCurrent(versionId: string) {
    try {
      await setCurrentVersion(versionId, projectId);
      await loadVersions();
      onVersionChange(versionId);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error setting current version:', error);
      alert('Failed to set current version');
    }
  }

  async function handleDelete(versionId: string, versionName: string) {
    if (!confirm(`Delete version "${versionName}"? This action cannot be undone.`)) return;

    try {
      await deleteVersion(versionId);
      await loadVersions();
    } catch (error: any) {
      console.error('Error deleting version:', error);
      alert(error.message || 'Failed to delete version');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <GitBranch className="h-4 w-4 animate-pulse" />
        <span>Loading versions...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 rounded-lg hover:border-blue-400 transition-colors"
          >
            <GitBranch className="h-4 w-4 text-blue-600" />
            <div className="text-left">
              <div className="text-xs text-slate-500">Current Version</div>
              <div className="font-semibold text-slate-900">
                {currentVersion?.version_number} - {currentVersion?.version_name}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-20 max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">All Versions</h3>
                  <p className="text-xs text-slate-500">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
                </div>

                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`px-4 py-3 hover:bg-slate-50 cursor-pointer border-l-4 ${
                      version.is_current
                        ? 'border-l-blue-600 bg-blue-50'
                        : 'border-l-transparent'
                    }`}
                    onClick={() => !version.is_current && handleSetCurrent(version.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {version.version_number}
                          </span>
                          {version.is_current && (
                            <span className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                              <Check className="h-3 w-3" />
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-700 mt-1">
                          {version.version_name}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{format(new Date(version.created_at), 'MMM dd, yyyy')}</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(version.total_amount || 0)}
                          </span>
                        </div>
                        {version.notes && (
                          <div className="text-xs text-slate-600 mt-1 italic">
                            {version.notes}
                          </div>
                        )}
                      </div>

                      {!version.is_current && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(version.id, version.version_name);
                          }}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete version"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Version
        </Button>

        {versions.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? <History className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {showHistory && (
        <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </h3>
          <div className="space-y-2">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  version.is_current ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      version.is_current ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'
                    }`}>
                      {versions.length - index}
                    </div>
                    {index < versions.length - 1 && (
                      <div className="w-0.5 h-8 bg-slate-300 my-1" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {version.version_number} - {version.version_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(new Date(version.created_at), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(version.total_amount || 0)}
                  </div>
                  {index > 0 && (
                    <button
                      onClick={() => onCompare(versions[index - 1].id, version.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                    >
                      Compare
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateVersionModal
          projectId={projectId}
          versions={versions}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            loadVersions();
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

interface CreateVersionModalProps {
  projectId: string;
  versions: ProjectVersion[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateVersionModal({ projectId, versions, onClose, onCreated }: CreateVersionModalProps) {
  const [versionName, setVersionName] = useState('');
  const [notes, setNotes] = useState('');
  const [createType, setCreateType] = useState<'empty' | 'duplicate'>('empty');
  const [sourceVersionId, setSourceVersionId] = useState('');
  const [updatePrices, setUpdatePrices] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (versions.length > 0 && createType === 'duplicate') {
      const current = versions.find(v => v.is_current);
      const defaultVersion = current || versions[0];

      if (defaultVersion && !sourceVersionId) {
        setSourceVersionId(defaultVersion.id);
      }
    }
  }, [createType, versions]);

  async function handleCreate() {
    if (!versionName.trim()) {
      alert('Please enter a version name');
      return;
    }

    setCreating(true);

    try {
      if (createType === 'empty') {
        await createEmptyVersion(projectId, versionName, notes);
      } else {
        if (!sourceVersionId) {
          alert('Please select a source version');
          return;
        }
        await duplicateVersion(sourceVersionId, projectId, versionName, notes, updatePrices);
      }

      onCreated();
    } catch (error: any) {
      console.error('Error creating version:', error);
      alert(error.message || 'Failed to create version');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Create New Version"
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Create From
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCreateType('empty')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                createType === 'empty'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Plus className="h-5 w-5 text-blue-600 mb-2" />
              <div className="font-semibold text-slate-900">Empty Version</div>
              <div className="text-xs text-slate-600 mt-1">
                Start from scratch
              </div>
            </button>

            <button
              onClick={() => setCreateType('duplicate')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                createType === 'duplicate'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Copy className="h-5 w-5 text-blue-600 mb-2" />
              <div className="font-semibold text-slate-900">Duplicate</div>
              <div className="text-xs text-slate-600 mt-1">
                Copy existing version
              </div>
            </button>
          </div>
        </div>

        {createType === 'duplicate' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Source Version
              </label>
              <select
                value={sourceVersionId}
                onChange={(e) => setSourceVersionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a version...</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_number} - {version.version_name}{version.is_current ? ' (Current)' : ''} - {formatCurrency(version.total_amount || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="updatePrices"
                checked={updatePrices}
                onChange={(e) => setUpdatePrices(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              />
              <label htmlFor="updatePrices" className="ml-3 text-sm text-slate-700">
                <span className="font-medium">Update prices to current</span>
                <div className="text-xs text-slate-600 mt-0.5">
                  Apply the latest price list to all materials and items
                </div>
              </label>
            </div>
          </>
        )}

        <Input
          label="Version Name"
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          placeholder="e.g., Premium Materials, Budget Option, Client Revision"
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this version..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Version'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
