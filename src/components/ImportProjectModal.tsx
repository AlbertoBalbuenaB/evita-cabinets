import { useState, useRef } from 'react';
import { Upload, X, FileJson, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { formatCurrency } from '../lib/calculations';
import { format } from 'date-fns';
import {
  validateProjectImport,
  performProjectImport,
  formatFileSize,
  type ValidationResult,
} from '../utils/projectExportImport';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (projectId: string) => void;
}

export function ImportProjectModal({ isOpen, onClose, onImportComplete }: ImportProjectModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importMode, setImportMode] = useState<'new' | 'version'>('new');
  const [targetProjectName, setTargetProjectName] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setValidationResult(null);
    setIsValidating(true);

    try {
      const result = await validateProjectImport(file);
      setValidationResult(result);
      if (result.isValid) {
        setTargetProjectName(result.newProjectName);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        isValid: false,
        warnings: [],
        newProjectName: '',
        projectData: null,
        error: 'Failed to validate file',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].name.endsWith('.evita.json')) {
      await handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleImportModeChange = async (mode: 'new' | 'version') => {
    setImportMode(mode);
    if (selectedFile) {
      setIsValidating(true);
      try {
        const result = await validateProjectImport(selectedFile);
        setValidationResult(result);
        if (result.isValid) {
          setTargetProjectName(result.newProjectName);
        }
      } catch (error) {
        console.error('Validation error:', error);
      } finally {
        setIsValidating(false);
      }
    }
  };

  const handleImport = async () => {
    if (!validationResult?.isValid || !validationResult.projectData || !targetProjectName.trim()) return;

    setIsImporting(true);

    try {
      const result = await performProjectImport(
        validationResult.projectData,
        targetProjectName.trim(),
        importMode
      );

      if (result.success) {
        onImportComplete(result.projectId);
        handleClose();
      } else {
        alert(`Import failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportMode('new');
    setTargetProjectName('');
    setIsValidating(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setTargetProjectName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Project" size="lg">
      <div className="space-y-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".evita.json"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {!selectedFile ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Upload className="h-12 w-12 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Drag and drop .evita.json file or click to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">Maximum file size: 10MB</p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
              >
                Select File
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <FileJson className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <Button
                onClick={handleClearFile}
                variant="ghost"
                size="sm"
                disabled={isValidating || isImporting}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {isValidating && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating project file...
          </div>
        )}

        {validationResult && !validationResult.isValid && validationResult.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-900">Validation Error</h3>
                <p className="text-sm text-red-700 mt-1">{validationResult.error}</p>
              </div>
            </div>
          </div>
        )}

        {validationResult?.isValid && validationResult.projectData && (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-slate-900">Project Preview</h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p>
                      <span className="font-medium">Original Name:</span>{' '}
                      {validationResult.projectData.project.name}
                    </p>
                    <p>
                      <span className="font-medium">Exported:</span>{' '}
                      {format(new Date(validationResult.projectData.exportDate), 'PPP')}
                    </p>
                    <p>
                      <span className="font-medium">Total Amount:</span>{' '}
                      {formatCurrency(validationResult.projectData.project.total_amount ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-slate-900">
                    {validationResult.projectData.metadata.totalAreas}
                  </p>
                  <p className="text-xs text-slate-500">Areas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-slate-900">
                    {validationResult.projectData.metadata.totalCabinets}
                  </p>
                  <p className="text-xs text-slate-500">Cabinets</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-slate-900">
                    {validationResult.projectData.metadata.totalItems +
                      validationResult.projectData.metadata.totalCountertops}
                  </p>
                  <p className="text-xs text-slate-500">Items</p>
                </div>
              </div>
            </div>

            {validationResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-900">
                      Materials Not Found ({validationResult.warnings.length})
                    </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      The following materials from the original project are not available in your
                      current price list. Cabinets using these materials will have $0 cost and
                      need manual updates.
                    </p>
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      <ul className="text-xs text-yellow-800 space-y-1">
                        {validationResult.warnings.slice(0, 10).map((warning, index) => (
                          <li key={index}>
                            {warning.materialType}: {warning.materialId}
                            {warning.cabinetSku && ` (${warning.cabinetSku})`}
                          </li>
                        ))}
                        {validationResult.warnings.length > 10 && (
                          <li className="font-medium">
                            ... and {validationResult.warnings.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Import Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="importMode"
                      value="new"
                      checked={importMode === 'new'}
                      onChange={() => handleImportModeChange('new')}
                      className="mt-0.5"
                      disabled={isImporting}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Import as new project</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Creates an independent copy of the project
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="importMode"
                      value="version"
                      checked={importMode === 'version'}
                      onChange={() => handleImportModeChange('version')}
                      className="mt-0.5"
                      disabled={isImporting}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Import as version</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Creates a versioned copy (e.g., Project - v2, Project - v3)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="targetProjectName" className="block text-sm font-medium text-slate-700 mb-2">
                  Project Name
                </label>
                <Input
                  id="targetProjectName"
                  value={targetProjectName}
                  onChange={(e) => setTargetProjectName(e.target.value)}
                  placeholder="Enter project name"
                  disabled={isImporting}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  You can customize the project name before importing
                </p>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!validationResult?.isValid || !targetProjectName.trim() || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              'Import Project'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
