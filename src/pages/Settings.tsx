import { useEffect, useState } from 'react';
import { Save, Upload, AlertCircle, Plus, Trash2, RefreshCw, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { clearSettingsCache, useSettingsStore } from '../lib/settingsStore';
import { downloadFullBackup, type BackupSummary } from '../utils/backupExport';
import type { Setting, TaxByType, CustomType, CustomUnit, TeamMember } from '../types';
import { useCurrentMember } from '../lib/useCurrentMember';

export function Settings() {
  const { member: currentMember } = useCurrentMember();
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [taxesByType, setTaxesByType] = useState<TaxByType[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomType[]>([]);
  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingWaste, setApplyingWaste] = useState(false);
  const [applyingTaxes, setApplyingTaxes] = useState(false);
  const [showDataImport, setShowDataImport] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newTaxType, setNewTaxType] = useState('');
  const [newTaxRate, setNewTaxRate] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState('');
  const [backupResult, setBackupResult] = useState<BackupSummary | null>(null);

  useEffect(() => {
    loadSettings();
    loadTaxesByType();
    loadCustomTypes();
    loadCustomUnits();
    loadTeamMembers();
    loadAllMembers();
  }, []);

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }

  async function loadTaxesByType() {
    try {
      const { data, error } = await supabase
        .from('taxes_by_type')
        .select('*')
        .order('material_type');

      if (error) throw error;
      setTaxesByType(data || []);
    } catch (error) {
      console.error('Error loading taxes by type:', error);
    }
  }

  async function loadCustomTypes() {
    try {
      const { data, error } = await supabase
        .from('custom_types')
        .select('*')
        .order('type_name');

      if (error) throw error;
      setCustomTypes(data || []);
    } catch (error) {
      console.error('Error loading custom types:', error);
    }
  }

  async function loadCustomUnits() {
    try {
      const { data, error } = await supabase
        .from('custom_units')
        .select('*')
        .order('unit_name');

      if (error) throw error;
      setCustomUnits(data || []);
    } catch (error) {
      console.error('Error loading custom units:', error);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const updates = settings.map((setting) => ({
        id: setting.id,
        value: setting.value,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .update({ value: update.value, updated_at: update.updated_at })
          .eq('id', update.id);

        if (error) throw error;
      }

      clearSettingsCache();
      useSettingsStore.getState().fetchSettings();
      setMessage({ type: 'success', text: 'Settings saved successfully! Changes will be applied to new calculations.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  function updateSetting(id: string, value: string) {
    setSettings(settings.map((s) => (s.id === id ? { ...s, value } : s)));
  }

  async function applyWastePercentage() {
    setApplyingWaste(true);
    setMessage(null);

    try {
      const boxWasteSetting = settings.find((s) => s.key === 'waste_percentage_box');
      const doorsWasteSetting = settings.find((s) => s.key === 'waste_percentage_doors');

      if (!boxWasteSetting || !doorsWasteSetting) {
        throw new Error('Waste percentage settings not found');
      }

      const boxWaste = parseFloat(boxWasteSetting.value);
      const doorsWaste = parseFloat(doorsWasteSetting.value);

      const { data: products, error: fetchError } = await supabase
        .from('products_catalog')
        .select('id, original_box_sf, original_doors_fronts_sf');

      if (fetchError) throw fetchError;

      if (!products || products.length === 0) {
        throw new Error('No products found');
      }

      for (const product of products) {
        const newBoxSF = product.original_box_sf * (1 + boxWaste / 100);
        const newDoorsSF = product.original_doors_fronts_sf * (1 + doorsWaste / 100);

        const { error: updateError } = await supabase
          .from('products_catalog')
          .update({
            box_sf: parseFloat(newBoxSF.toFixed(2)),
            doors_fronts_sf: parseFloat(newDoorsSF.toFixed(2)),
            waste_applied: true,
          })
          .eq('id', product.id);

        if (updateError) throw updateError;
      }

      setMessage({
        type: 'success',
        text: `Waste percentages applied successfully to ${products.length} products!`,
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error applying waste percentage:', error);
      setMessage({ type: 'error', text: 'Failed to apply waste percentages' });
    } finally {
      setApplyingWaste(false);
    }
  }

  async function addTaxByType() {
    if (!newTaxType.trim()) return;

    try {
      const { error } = await supabase
        .from('taxes_by_type')
        .insert({ material_type: newTaxType, tax_percentage: newTaxRate });

      if (error) throw error;

      setNewTaxType('');
      setNewTaxRate(0);
      loadTaxesByType();
      setMessage({ type: 'success', text: 'Tax rate added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding tax rate:', error);
      setMessage({ type: 'error', text: 'Failed to add tax rate' });
    }
  }

  async function updateTaxRate(id: string, taxPercentage: number) {
    try {
      const { error } = await supabase
        .from('taxes_by_type')
        .update({ tax_percentage: taxPercentage, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      loadTaxesByType();
    } catch (error) {
      console.error('Error updating tax rate:', error);
    }
  }

  async function deleteTaxByType(id: string) {
    try {
      const { error } = await supabase.from('taxes_by_type').delete().eq('id', id);
      if (error) throw error;
      loadTaxesByType();
      setMessage({ type: 'success', text: 'Tax rate deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting tax rate:', error);
      setMessage({ type: 'error', text: 'Failed to delete tax rate' });
    }
  }

  async function addCustomType() {
    if (!newTypeName.trim()) return;

    try {
      const { error } = await supabase.from('custom_types').insert({ type_name: newTypeName });
      if (error) throw error;

      setNewTypeName('');
      loadCustomTypes();
      setMessage({ type: 'success', text: 'Type added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding type:', error);
      setMessage({ type: 'error', text: 'Failed to add type' });
    }
  }

  async function deleteCustomType(id: string) {
    try {
      const { error } = await supabase.from('custom_types').delete().eq('id', id);
      if (error) throw error;
      loadCustomTypes();
      setMessage({ type: 'success', text: 'Type deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting type:', error);
      setMessage({ type: 'error', text: 'Failed to delete type' });
    }
  }

  async function addCustomUnit() {
    if (!newUnitName.trim()) return;

    try {
      const { error } = await supabase.from('custom_units').insert({ unit_name: newUnitName });
      if (error) throw error;

      setNewUnitName('');
      loadCustomUnits();
      setMessage({ type: 'success', text: 'Unit added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding unit:', error);
      setMessage({ type: 'error', text: 'Failed to add unit' });
    }
  }

  async function deleteCustomUnit(id: string) {
    try {
      const { error } = await supabase.from('custom_units').delete().eq('id', id);
      if (error) throw error;
      loadCustomUnits();
      setMessage({ type: 'success', text: 'Unit deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting unit:', error);
      setMessage({ type: 'error', text: 'Failed to delete unit' });
    }
  }

  async function loadTeamMembers() {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  async function loadAllMembers() {
    const { data } = await supabase.from('team_members').select('*').order('display_order');
    setAllMembers(data || []);
  }

  async function toggleMemberActive(id: string, isActive: boolean) {
    await supabase.from('team_members').update({ is_active: !isActive }).eq('id', id);
    loadAllMembers();
    loadTeamMembers();
  }

  async function changeMemberRole(id: string, role: string) {
    await supabase.from('team_members').update({ role }).eq('id', id);
    loadAllMembers();
  }

  async function addTeamMember() {
    if (!newMemberName.trim()) return;

    try {
      const { error } = await supabase.from('team_members').insert({
        name: newMemberName,
        role: newMemberRole || null,
        email: newMemberEmail || null,
      });
      if (error) throw error;

      setNewMemberName('');
      setNewMemberRole('');
      setNewMemberEmail('');
      loadTeamMembers();
      setMessage({ type: 'success', text: 'Team member added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding team member:', error);
      setMessage({ type: 'error', text: 'Failed to add team member' });
    }
  }

  async function deleteTeamMember(id: string) {
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
      loadTeamMembers();
      setMessage({ type: 'success', text: 'Team member removed successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting team member:', error);
      setMessage({ type: 'error', text: 'Failed to remove team member' });
    }
  }

  async function applyTaxesToPriceList() {
    setApplyingTaxes(true);
    setMessage(null);

    try {
      const { data: priceListItems, error: fetchError } = await supabase
        .from('price_list')
        .select('id, type, base_price, price');

      if (fetchError) throw fetchError;

      if (!priceListItems || priceListItems.length === 0) {
        throw new Error('No price list items found');
      }

      for (const item of priceListItems) {
        const taxConfig = taxesByType.find((t) => t.material_type === item.type);
        const taxRate = taxConfig ? taxConfig.tax_percentage : 0;
        const basePrice = item.base_price || item.price;
        const priceWithTax = basePrice * (1 + taxRate / 100);

        const { error: updateError } = await supabase
          .from('price_list')
          .update({
            base_price: basePrice,
            tax_rate: taxRate,
            price_with_tax: parseFloat(priceWithTax.toFixed(2)),
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      setMessage({
        type: 'success',
        text: `Taxes applied successfully to ${priceListItems.length} items!`,
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error applying taxes:', error);
      setMessage({ type: 'error', text: 'Failed to apply taxes' });
    } finally {
      setApplyingTaxes(false);
    }
  }

  async function handleDownloadBackup() {
    setBackupLoading(true);
    setBackupResult(null);
    setBackupProgress('Preparing backup...');
    try {
      const summary = await downloadFullBackup((step) => setBackupProgress(step));
      setBackupResult(summary);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Backup failed' });
    } finally {
      setBackupLoading(false);
      setBackupProgress('');
    }
  }

  const laborSettings = settings.filter((s) => s.category === 'labor');
  const wasteSettings = settings.filter((s) => s.category === 'waste');
  const currencySettings = settings.filter((s) => s.category === 'currency');

  if (loading) {
    return (
      <div className="space-y-8 page-enter">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-36 skeleton-shimmer" />
            <div className="h-4 w-64 skeleton-shimmer" />
          </div>
          <div className="h-10 w-32 skeleton-shimmer" />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 h-48 animate-pulse" style={{ borderRadius: '14px' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 page-enter">
      <div className="flex items-center justify-between hero-enter">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-1">Configure system settings and import data</p>
        </div>
        <Button onClick={() => setShowDataImport(!showDataImport)} variant="secondary">
          <Upload className="h-4 w-4 mr-2" />
          {showDataImport ? 'Hide Import' : 'Import Data'}
        </Button>
      </div>

      {message && (
        <div
          className={`flex items-center space-x-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <AlertCircle className="h-5 w-5" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Local Backup</h2>
            <p className="text-slate-500 text-sm mt-1">
              Download a ZIP archive with all your data for safe local storage. The files are compatible for re-importing into this system.
            </p>
          </div>
          <Button
            onClick={handleDownloadBackup}
            disabled={backupLoading}
            variant="primary"
          >
            {backupLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {backupProgress || 'Preparing...'}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Backup
              </>
            )}
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Projects</p>
            <p className="text-sm text-slate-700">Exported as individual <code className="bg-slate-200 px-1 rounded text-xs">.evita.json</code> files, ready to re-import via the Projects page.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Products Catalog</p>
            <p className="text-sm text-slate-700">Exported as <code className="bg-slate-200 px-1 rounded text-xs">products_catalog.csv</code>, compatible with the CSV import in this page.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Price List</p>
            <p className="text-sm text-slate-700">Exported as <code className="bg-slate-200 px-1 rounded text-xs">price_list.csv</code>, compatible with the CSV import in this page.</p>
          </div>
        </div>

        {backupResult && (
          <div className="mt-4 flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Backup downloaded successfully</p>
              <p className="text-sm text-green-700 mt-0.5">
                {backupResult.projectCount} {backupResult.projectCount === 1 ? 'project' : 'projects'},{' '}
                {backupResult.productCount} {backupResult.productCount === 1 ? 'product' : 'products'},{' '}
                {backupResult.priceListCount} price list {backupResult.priceListCount === 1 ? 'item' : 'items'} &mdash; saved as <strong>{backupResult.fileName}</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {showDataImport && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Import Data</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Import Products Catalog</h3>
              <p className="text-sm text-slate-600 mb-3">
                Upload a CSV file with product catalog data. The file should include columns for SKU,
                description, dimensions, and other product details.
              </p>
              <input
                type="file"
                accept=".csv"
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Import Price List</h3>
              <p className="text-sm text-slate-600 mb-3">
                Upload a CSV file with price list data. The file should include columns for concept,
                type, dimensions, price, and unit.
              </p>
              <input
                type="file"
                accept=".csv"
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                For detailed information about CSV file formats, please refer to the CSV Format
                Reference documentation included with the application.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Taxes by Material Type</h2>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> Configure tax percentages for different material types.
              These taxes are automatically applied to price list items based on their type.
              For example, all Metal items can have 25% tax, all Fabric items 25%, etc.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Important:</strong> After changing tax rates, click "Apply Taxes to Price List"
              to recalculate all prices with the new tax rates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxesByType.map((tax) => (
              <div key={tax.id} className="flex items-center space-x-2 bg-slate-50 p-3 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{tax.material_type}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={tax.tax_percentage}
                      onChange={(e) => {
                        const updated = taxesByType.map((t) =>
                          t.id === tax.id ? { ...t, tax_percentage: parseFloat(e.target.value) || 0 } : t
                        );
                        setTaxesByType(updated);
                      }}
                      onBlur={() => updateTaxRate(tax.id, tax.tax_percentage)}
                      className="max-w-[100px]"
                    />
                    <span className="text-slate-600">%</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTaxByType(tax.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Add New Tax Rate</h3>
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">Material Type</label>
                <Input
                  type="text"
                  value={newTaxType}
                  onChange={(e) => setNewTaxType(e.target.value)}
                  placeholder="e.g., Wood, Plastic"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-slate-600 mb-1">Tax %</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <Button onClick={addTaxByType}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <Button onClick={applyTaxesToPriceList} disabled={applyingTaxes} variant="secondary">
              <RefreshCw className="h-4 w-4 mr-2" />
              {applyingTaxes ? 'Applying Taxes...' : 'Apply Taxes to Price List'}
            </Button>
            <p className="text-xs text-slate-500 mt-2">
              This will recalculate all price list items with their respective tax rates.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Custom Types</h2>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Manage custom types for the price list. These types are used to categorize materials and products.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {customTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                <span className="text-sm text-slate-700">{type.type_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteCustomType(type.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Add New Type</h3>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g., Laminate, Veneer"
                className="flex-1"
              />
              <Button onClick={addCustomType}>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Custom Units</h2>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Manage custom units for the price list. These units are used for measuring quantities.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {customUnits.map((unit) => (
              <div key={unit.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                <span className="text-sm text-slate-700">{unit.unit_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteCustomUnit(unit.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Add New Unit</h3>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g., Gallon, Liter"
                className="flex-1"
              />
              <Button onClick={addCustomUnit}>
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Labor Costs</h2>
        <div className="space-y-4">
          {laborSettings.map((setting) => (
            <div key={setting.id}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {setting.description}
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-slate-600">$</span>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={setting.value}
                  onChange={(e) => updateSetting(setting.id, e.target.value)}
                  className="max-w-xs"
                />
                <span className="text-slate-600">MXN</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Currency Exchange Rate</h2>
        <div className="space-y-4">
          {currencySettings.map((setting) => (
            <div key={setting.id}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {setting.description}
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-slate-600">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={setting.value}
                  onChange={(e) => updateSetting(setting.id, e.target.value)}
                  className="max-w-xs"
                />
                <span className="text-slate-600">MXN per USD</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                This rate is used when displaying amounts in Mexican Pesos
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Company Logo</h2>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 font-medium mb-2">
              How to upload your company logo:
            </p>
            <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
              <li>Go to your Supabase Dashboard</li>
              <li>Navigate to Storage in the left sidebar</li>
              <li>Open the "logos" bucket</li>
              <li>Upload your logo file with the exact name: <code className="bg-amber-100 px-2 py-0.5 rounded font-mono text-xs">evita_logo.png</code></li>
              <li>The logo will automatically appear in your quotation PDFs</li>
            </ol>
            <p className="text-sm text-amber-800 mt-3">
              <strong>Note:</strong> The file must be named exactly "evita_logo.png" (PNG format recommended for best quality)
            </p>
          </div>

          <div className="flex items-start space-x-3 text-sm text-slate-600">
            <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p>Recommended logo specifications:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Format: PNG with transparent background</li>
                <li>Dimensions: 300x60 pixels (or similar aspect ratio)</li>
                <li>File size: Under 500KB</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Material Waste Percentages</h2>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> Waste percentages are applied directly to the Box SF
              and Doors SF values in the Products Catalog. For example, if a product has 24.58 Box SF
              and you apply 20% waste, it will become 29.49 SF. These adjusted values are then used
              in all quotations.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Important:</strong> After changing these percentages, you must click "Apply to
              All Products" to update the catalog values. This will recalculate all products based on
              their original SF values.
            </p>
          </div>

          {wasteSettings.map((setting) => (
            <div key={setting.id}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {setting.description}
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={setting.value}
                  onChange={(e) => updateSetting(setting.id, e.target.value)}
                  className="max-w-xs"
                />
                <span className="text-slate-600">%</span>
              </div>
            </div>
          ))}

          <div className="pt-4 mt-6 border-t border-slate-200">
            <Button
              onClick={applyWastePercentage}
              disabled={applyingWaste}
              variant="secondary"
            >
              {applyingWaste ? 'Applying to All Products...' : 'Apply to All Products'}
            </Button>
            <p className="text-xs text-slate-500 mt-2">
              This will update all products in the catalog using the waste percentages above.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 section-enter">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Team Members</h2>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Manage team members who can be assigned to project tasks.
          </p>

          {teamMembers.length > 0 && (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm font-medium text-slate-900">{member.name}</span>
                    {member.role && <span className="text-sm text-slate-500">{member.role}</span>}
                    {member.email && <span className="text-sm text-slate-400">{member.email}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTeamMember(member.id)}
                    className="text-red-600 hover:text-red-700 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Add Team Member</h3>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">Name *</label>
                <Input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">Role</label>
                <Input
                  type="text"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  placeholder="e.g., Designer, PM"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">Email</label>
                <Input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <Button onClick={addTeamMember} disabled={!newMemberName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin: User Management ──────────────────────────────────────── */}
      {currentMember?.role === 'admin' && (
        <div className="glass-white rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">System Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Nombre</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Rol</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Vinculado</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Estado</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allMembers.map(m => {
                  const isSelf = m.id === currentMember.id;
                  return (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {m.name}
                        {isSelf && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{m.email || '—'}</td>
                      <td className="py-2.5 px-3">
                        <select
                          value={m.role || 'user'}
                          onChange={e => changeMemberRole(m.id, e.target.value)}
                          disabled={isSelf}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 disabled:opacity-50"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {m.auth_user_id ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-slate-300">✗</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {m.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => toggleMemberActive(m.id, m.is_active)}
                          disabled={isSelf}
                          className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {m.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
