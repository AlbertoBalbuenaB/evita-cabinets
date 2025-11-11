import { useState, useEffect } from 'react';
import { Search, AlertCircle, Check, Layers } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { getAllTemplates, searchTemplates, validateTemplateAvailability } from '../lib/templateManager';
import type { CabinetTemplate, PriceListItem, Product, TemplateCategory } from '../types';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: CabinetTemplate) => void;
  priceList: PriceListItem[];
  products: Product[];
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Base Cabinets',
  'Wall Cabinets',
  'Tall Cabinets',
  'Specialty',
  'Accessories',
  'General',
];

export function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelectTemplate,
  priceList,
  products,
}: TemplateSelectorModalProps) {
  const [templates, setTemplates] = useState<CabinetTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CabinetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<CabinetTemplate | null>(null);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    missingMaterials: string[];
    inactiveProduct: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, selectedCategory]);

  useEffect(() => {
    if (selectedTemplate) {
      validateTemplate(selectedTemplate);
    } else {
      setValidationStatus(null);
    }
  }, [selectedTemplate]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const data = await getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterTemplates() {
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

    filtered = [...filtered].sort((a, b) => b.usage_count - a.usage_count);

    setFilteredTemplates(filtered);
  }

  async function validateTemplate(template: CabinetTemplate) {
    const status = await validateTemplateAvailability(template, priceList, products);
    setValidationStatus(status);
  }

  function handleSelectTemplate() {
    if (selectedTemplate) {
      if (validationStatus && !validationStatus.isValid) {
        const confirmMessage = `This template has some materials that are no longer available:\n\n${validationStatus.missingMaterials.join('\n')}\n\nYou will need to select alternative materials. Continue?`;
        if (!confirm(confirmMessage)) {
          return;
        }
      }
      onSelectTemplate(selectedTemplate);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Load from Template" size="xl">
      <div className="space-y-4">
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading templates...</div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600">No templates found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search or create a new template
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
            <div className="grid grid-cols-1 divide-y divide-slate-200">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`text-left p-4 hover:bg-slate-50 transition-colors ${
                    selectedTemplate?.id === template.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-slate-900">{template.name}</h3>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          {template.category}
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                          {template.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Product: {template.product_sku || 'N/A'}</span>
                        <span>Used {template.usage_count} times</span>
                        {(template.use_box_interior_finish || template.use_doors_interior_finish) && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Layers className="h-3 w-3" />
                            Composite Materials
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <Check className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTemplate && validationStatus && !validationStatus.isValid && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-medium text-yellow-800 mb-2">
                  Some materials are no longer available
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {validationStatus.missingMaterials.map((material, index) => (
                    <li key={index}>• {material}</li>
                  ))}
                </ul>
                {validationStatus.inactiveProduct && (
                  <p className="text-sm text-yellow-700 mt-2">
                    • The product associated with this template is inactive
                  </p>
                )}
                <p className="text-sm text-yellow-800 mt-2 font-medium">
                  You will need to select alternative materials after loading this template.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedTemplate && validationStatus?.isValid && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="space-y-2">
              <p className="text-sm text-green-800">
                <Check className="h-4 w-4 inline mr-1" />
                All materials are available. Template is ready to use.
              </p>
              {(selectedTemplate.use_box_interior_finish || selectedTemplate.use_doors_interior_finish) && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  <p className="text-xs text-amber-800 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="font-medium">This template uses composite materials:</span>
                  </p>
                  <ul className="text-xs text-amber-700 mt-1 ml-5 space-y-0.5">
                    {selectedTemplate.use_box_interior_finish && (
                      <li>• Box: {selectedTemplate.box_material_name} + {selectedTemplate.box_interior_finish_name}</li>
                    )}
                    {selectedTemplate.use_doors_interior_finish && (
                      <li>• Doors: {selectedTemplate.doors_material_name} + {selectedTemplate.doors_interior_finish_name}</li>
                    )}
                  </ul>
                  <p className="text-xs text-amber-600 mt-1.5 italic">
                    Both materials will require the same number of sheets.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelectTemplate}
            disabled={!selectedTemplate}
          >
            Use This Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}
