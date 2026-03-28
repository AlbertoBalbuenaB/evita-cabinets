import { useEffect, useState } from 'react';
import { Search, Filter, X, TrendingUp, BarChart3, Clock, Bookmark, CreditCard as Edit2, Trash2, Copy } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import {
  getAllTemplates,
  searchTemplates,
  getTemplatesByCategory,
  deleteTemplate,
  duplicateTemplate,
  getTemplateAnalytics,
  getRecentlyUsedTemplates,
  generateUniqueTemplateName,
  updateTemplate,
} from '../lib/templateManager';
import type { CabinetTemplate, TemplateAnalytics, TemplateCategory } from '../types';

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Base Cabinets',
  'Wall Cabinets',
  'Tall Cabinets',
  'Specialty',
  'Accessories',
  'General',
];

interface TemplatesProps {
  embedded?: boolean;
}

export function Templates({ embedded = false }: TemplatesProps) {
  const [templates, setTemplates] = useState<CabinetTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CabinetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('usage');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<TemplateAnalytics | null>(null);
  const [recentTemplates, setRecentTemplates] = useState<CabinetTemplate[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<CabinetTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<CabinetTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<CabinetTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
    loadRecentTemplates();
  }, []);

  useEffect(() => {
    filterAndSortTemplates();
  }, [templates, searchTerm, selectedCategory, sortBy]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const data = await getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentTemplates() {
    try {
      const recent = await getRecentlyUsedTemplates(5);
      setRecentTemplates(recent);
    } catch (error) {
      console.error('Error loading recent templates:', error);
    }
  }

  async function loadAnalytics() {
    try {
      const data = await getTemplateAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      alert('Failed to load analytics');
    }
  }

  function filterAndSortTemplates() {
    let filtered = templates;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(term) ||
          t.description?.toLowerCase().includes(term) ||
          t.product_sku?.toLowerCase().includes(term)
      );
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'usage') {
        return b.usage_count - a.usage_count;
      } else {
        const dateA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const dateB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        return dateB - dateA;
      }
    });

    setFilteredTemplates(filtered);
  }

  async function handleDeleteTemplate(template: CabinetTemplate) {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await deleteTemplate(template.id);
      await loadTemplates();
      setDeletingTemplate(null);
      alert('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  }

  async function handleDuplicateTemplate(template: CabinetTemplate) {
    try {
      const existingNames = templates.map(t => t.name);
      const newName = generateUniqueTemplateName(`${template.name} (Copy)`, existingNames);

      await duplicateTemplate(template.id, newName);
      await loadTemplates();
      alert(`Template duplicated as "${newName}"`);
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      alert(error.message || 'Failed to duplicate template');
    }
  }

  function handleShowAnalytics() {
    setShowAnalytics(true);
    if (!analytics) {
      loadAnalytics();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cabinet Templates</h1>
            <p className="mt-1 text-sm text-slate-600">
              Reusable cabinet configurations for faster quotations
            </p>
          </div>
          <Button onClick={handleShowAnalytics} variant="secondary">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button onClick={handleShowAnalytics} variant="secondary">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>
      )}

      {recentTemplates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Clock className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="font-semibold text-slate-900">Recently Used Templates</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recentTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setPreviewTemplate(template)}
                className="text-left px-3 py-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-slate-900 text-sm">{template.name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Used {template.usage_count} times
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Categories</option>
              {TEMPLATE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="usage">Most Used</option>
              <option value="recent">Recently Used</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Bookmark className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 mb-2">
            {searchTerm || selectedCategory !== 'All'
              ? 'No templates match your search criteria'
              : 'No templates yet'}
          </p>
          <p className="text-sm text-slate-500">
            {searchTerm || selectedCategory !== 'All'
              ? 'Try adjusting your filters'
              : 'Create a cabinet in a project and save it as a template to get started'}
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-slate-600">
            Showing {filteredTemplates.length} of {templates.length} templates
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{template.name}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                        {template.category}
                      </span>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Product:</span>
                      <span className="font-medium">{template.product_sku || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Box Material:</span>
                      <span className="font-medium truncate ml-2">
                        {template.box_material_name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Doors Material:</span>
                      <span className="font-medium truncate ml-2">
                        {template.doors_material_name || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Used {template.usage_count} times
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicateTemplate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {editingTemplate && (
        <TemplateEditModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={async (updates) => {
            try {
              await updateTemplate(editingTemplate.id, updates);
              await loadTemplates();
              setEditingTemplate(null);
              alert('Template updated successfully');
            } catch (error: any) {
              console.error('Error updating template:', error);
              alert(error.message || 'Failed to update template');
            }
          }}
        />
      )}

      {deletingTemplate && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingTemplate(null)}
          title="Delete Template"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-slate-700">
              Are you sure you want to delete the template "{deletingTemplate.name}"?
            </p>
            {deletingTemplate.usage_count > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  This template has been used {deletingTemplate.usage_count} times in projects.
                  Deleting it will not affect existing cabinets.
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setDeletingTemplate(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleDeleteTemplate(deletingTemplate)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Template
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showAnalytics && analytics && (
        <TemplateAnalyticsModal
          analytics={analytics}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  );
}

interface TemplatePreviewModalProps {
  template: CabinetTemplate;
  onClose: () => void;
}

function TemplatePreviewModal({ template, onClose }: TemplatePreviewModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Template Details" size="lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
          <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            {template.category}
          </span>
        </div>

        {template.description && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-1">Description</h4>
            <p className="text-sm text-slate-600">{template.description}</p>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Configuration</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Product SKU</label>
              <p className="text-sm font-medium text-slate-900">{template.product_sku || 'N/A'}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500">RTA Status</label>
              <p className="text-sm font-medium text-slate-900">
                {template.is_rta ? 'Ready to Assemble' : 'Pre-Assembled'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Box Construction</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Material:</span>
              <span className="font-medium">{template.box_material_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Edgeband:</span>
              <span className="font-medium">{template.box_edgeband_name || 'N/A'}</span>
            </div>
            {template.use_box_interior_finish && (
              <div className="flex justify-between">
                <span className="text-slate-600">Interior Finish:</span>
                <span className="font-medium">{template.box_interior_finish_name || 'N/A'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Doors & Fronts</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Material:</span>
              <span className="font-medium">{template.doors_material_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Edgeband:</span>
              <span className="font-medium">{template.doors_edgeband_name || 'N/A'}</span>
            </div>
            {template.use_doors_interior_finish && (
              <div className="flex justify-between">
                <span className="text-slate-600">Interior Finish:</span>
                <span className="font-medium">{template.doors_interior_finish_name || 'N/A'}</span>
              </div>
            )}
          </div>
        </div>

        {Array.isArray(template.hardware) && template.hardware.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Hardware</h4>
            <div className="text-sm text-slate-600">
              {template.hardware.length} hardware item(s) configured
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Usage Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs text-slate-500">Times Used</label>
              <p className="text-lg font-semibold text-slate-900">{template.usage_count}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500">Last Used</label>
              <p className="text-sm font-medium text-slate-900">
                {template.last_used_at
                  ? new Date(template.last_used_at).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

interface TemplateEditModalProps {
  template: CabinetTemplate;
  onClose: () => void;
  onSave: (updates: Partial<CabinetTemplate>) => Promise<void>;
}

function TemplateEditModal({ template, onClose, onSave }: TemplateEditModalProps) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [category, setCategory] = useState<TemplateCategory>(template.category);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      alert('Template name is required');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        category,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Template" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter template name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter template description (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TEMPLATE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Only the name, description, and category can be edited.
            To change materials or hardware, create a new template from a cabinet.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface TemplateAnalyticsModalProps {
  analytics: TemplateAnalytics;
  onClose: () => void;
}

function TemplateAnalyticsModal({ analytics, onClose }: TemplateAnalyticsModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Template Analytics" size="xl">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Total Templates</div>
            <div className="text-2xl font-bold text-slate-900">{analytics.totalTemplates}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Total Uses</div>
            <div className="text-2xl font-bold text-slate-900">{analytics.totalUses}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1">Avg Uses per Template</div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics.averageUsesPerTemplate.toFixed(1)}
            </div>
          </div>
        </div>

        {analytics.mostUsedTemplates.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Top 10 Most Used Templates</h3>
            <div className="space-y-2">
              {analytics.mostUsedTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{template.name}</div>
                      <div className="text-xs text-slate-600">{template.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{template.usage_count} uses</div>
                    {template.last_used_at && (
                      <div className="text-xs text-slate-600">
                        Last: {new Date(template.last_used_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analytics.usageByCategory.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Usage by Category</h3>
            <div className="space-y-2">
              {analytics.usageByCategory.map(cat => (
                <div key={cat.category} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-900">{cat.category}</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900">{cat.total_uses} uses</span>
                    <span className="text-slate-600 ml-2">
                      ({cat.total_templates} templates)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
