import { useState, useEffect } from 'react';
import { AlertCircle, Package } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { CollectionSelector } from './CollectionSelector';
import type { Product, ProductInsert } from '../types';
import {
  createProductVersion,
  generateVersionedSku,
  getExistingSkus,
} from '../lib/safeProductEdit';
import type { ProductUsage } from '../lib/productUsageChecker';

interface SafeEditModalProps {
  product: Product;
  usage: ProductUsage;
  updates: Partial<ProductInsert>;
  onSuccess: (newProduct: Product) => void;
  onCancel: () => void;
}

export function SafeEditModal({
  product,
  usage,
  updates,
  onSuccess,
  onCancel,
}: SafeEditModalProps) {
  const [newSku, setNewSku] = useState('');
  const [archiveOriginal, setArchiveOriginal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collectionName, setCollectionName] = useState(
    updates.collection_name ?? product.collection_name ?? 'Standard Catalog'
  );

  useEffect(() => {
    async function initializeSku() {
      const existingSkus = await getExistingSkus();
      const suggestedSku = generateVersionedSku(product.sku, existingSkus);
      setNewSku(suggestedSku);
    }
    initializeSku();
  }, [product.sku]);

  async function handleSaveAsNewVersion() {
    setSaving(true);
    try {
      const updatesWithCollection = {
        ...updates,
        collection_name: collectionName,
      };

      const newProduct = await createProductVersion(product, updatesWithCollection, {
        newSku,
        archiveOriginal,
      });

      onSuccess(newProduct);
    } catch (error) {
      console.error('Error creating product version:', error);
      alert('Failed to create new version. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={true} onClose={onCancel} title="Product in Use - Create New Version" size="lg">
      <div className="space-y-4">
        <div className="bg-status-amber-bg border border-status-amber-brd rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-status-amber-fg mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-status-amber-fg mb-1">
              This product is currently in use
            </h3>
            <p className="text-sm text-status-amber-fg">
              This product is used in <strong>{usage.usageCount}</strong> cabinet
              {usage.usageCount !== 1 ? 's' : ''} across{' '}
              <strong>{usage.projectNames.length}</strong> project
              {usage.projectNames.length !== 1 ? 's' : ''}.
            </p>
            {usage.projectNames.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-status-amber-fg mb-1">Projects:</p>
                <ul className="text-xs text-status-amber-fg list-disc list-inside max-h-24 overflow-y-auto">
                  {usage.projectNames.slice(0, 10).map((name, idx) => (
                    <li key={idx}>{name}</li>
                  ))}
                  {usage.projectNames.length > 10 && (
                    <li>...and {usage.projectNames.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="bg-accent-tint-soft border border-accent-tint-border rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Package className="h-5 w-5 text-accent-text mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-accent-text mb-1">Safe Editing Solution</h3>
              <p className="text-sm text-accent-text">
                To protect historical project data, your changes will be saved as a new product
                version. Historical projects will continue to reference the original product.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border-soft pt-4">
          <h3 className="text-sm font-semibold text-fg-900 mb-3">New Version Details</h3>

          <div className="space-y-4">
            <Input
              label="New SKU / Code"
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder="Enter new SKU"
              required
            />

            <CollectionSelector value={collectionName} onChange={setCollectionName} />

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={archiveOriginal}
                onChange={(e) => setArchiveOriginal(e.target.checked)}
                className="mt-1 w-4 h-4 text-accent-text border-border-solid rounded focus-visible:ring-focus"
              />
              <div>
                <span className="text-sm font-medium text-fg-700">
                  Archive original product
                </span>
                <p className="text-xs text-fg-500 mt-0.5">
                  The original product will be hidden from new projects but preserved for
                  historical data
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="bg-surf-app border border-border-soft rounded-lg p-3">
          <h4 className="text-xs font-semibold text-fg-700 mb-2">What will happen:</h4>
          <ul className="text-xs text-fg-600 space-y-1 list-disc list-inside">
            <li>
              New product will be created with SKU: <strong>{newSku || '(pending)'}</strong>
            </li>
            <li>Your changes will be applied to the new version</li>
            <li>Historical projects will continue using the original product</li>
            {archiveOriginal ? (
              <li>Original product will be archived and hidden from new projects</li>
            ) : (
              <li>Original product will remain active and available</li>
            )}
          </ul>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveAsNewVersion} disabled={!newSku.trim() || saving}>
            {saving ? 'Creating Version...' : 'Save as New Version'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
