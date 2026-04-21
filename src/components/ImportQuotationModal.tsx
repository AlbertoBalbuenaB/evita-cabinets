import { useState, useRef, useEffect } from 'react';
import { Upload, X, FileJson, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { supabase } from '../lib/supabase';
import {
  validateQuotationImport,
  performQuotationImport,
  createProjectWithFirstQuotation,
  formatFileSize,
  type ValidationResult,
} from '../utils/projectExportImport';
import type { Project } from '../types';

interface ImportQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onSuccess: (quotationId: string, projectId?: string) => void;
}

export function ImportQuotationModal({ isOpen, onClose, projectId, onSuccess }: ImportQuotationModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Project selection (when no projectId is provided)
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [createNew, setCreateNew] = useState(!projectId);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (!projectId && isOpen) {
      supabase.from('projects').select('id, name').order('updated_at', { ascending: false })
        .then(({ data }) => setProjects((data || []) as any));
    }
  }, [projectId, isOpen]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setValidationResult(null);
    setIsValidating(true);

    try {
      const result = await validateQuotationImport(file);
      setValidationResult(result);
      if (result.isValid && !newProjectName) {
        setNewProjectName(result.newProjectName);
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult?.isValid || !validationResult.projectData) return;

    const targetProjectId = projectId || selectedProjectId;

    if (!createNew && !targetProjectId) {
      alert('Please select a project or choose "Create new project".');
      return;
    }

    setIsImporting(true);

    try {
      if (createNew && !targetProjectId) {
        const result = await createProjectWithFirstQuotation(
          validationResult.projectData,
          newProjectName.trim() || validationResult.newProjectName
        );

        if (result.success) {
          onSuccess(result.quotationId, result.projectId);
          handleClose();
        } else {
          alert(`Import failed: ${result.error || 'Unknown error'}`);
        }
      } else {
        const result = await performQuotationImport(
          validationResult.projectData,
          targetProjectId,
          versionLabel.trim() || undefined
        );

        if (result.success) {
          onSuccess(result.quotationId, targetProjectId);
          handleClose();
        } else {
          alert(`Import failed: ${result.error || 'Unknown error'}`);
        }
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
    setVersionLabel('');
    setNewProjectName('');
    setSelectedProjectId(projectId || '');
    setCreateNew(!projectId);
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Quotation" size="md">
      <div className="space-y-4">
        {/* Project selection (only when projectId not provided) */}
        {!projectId && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-fg-700">Import into:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCreateNew(false)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${!createNew ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border-soft text-fg-600 hover:bg-surf-app'}`}
              >
                Existing Project
              </button>
              <button
                onClick={() => setCreateNew(true)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${createNew ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border-soft text-fg-600 hover:bg-surf-app'}`}
              >
                New Project
              </button>
            </div>

            {createNew ? (
              <Input
                label="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name..."
              />
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border-soft rounded-lg"
              >
                <option value="">Select a project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Version label */}
        <Input
          label="Version Label (optional)"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          placeholder="e.g., Plus, Premium, v2"
        />

        {/* File upload */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-border-solid hover:border-blue-300'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.evita.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileJson className="h-8 w-8 text-blue-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-fg-900">{selectedFile.name}</p>
                <p className="text-xs text-fg-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setValidationResult(null); }} className="p-1 rounded hover:bg-surf-muted">
                <X className="h-4 w-4 text-fg-400" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="h-10 w-10 text-fg-400 mx-auto mb-2" />
              <p className="text-sm text-fg-600">Drop .evita.json file here or click to browse</p>
            </div>
          )}
        </div>

        {/* Validation status */}
        {isValidating && (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Validating...</span>
          </div>
        )}

        {validationResult && (
          <div className={`rounded-lg p-3 ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {validationResult.isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${validationResult.isValid ? 'text-green-700' : 'text-red-700'}`}>
                {validationResult.isValid ? 'File is valid' : validationResult.error}
              </span>
            </div>
            {validationResult.isValid && validationResult.projectData && (
              <div className="text-xs text-fg-600 mt-2 space-y-0.5">
                <p>{validationResult.projectData.metadata.totalAreas} areas, {validationResult.projectData.metadata.totalCabinets} cabinets</p>
                <p>Original: {validationResult.projectData.project.name}</p>
              </div>
            )}
            {validationResult.warnings.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">{validationResult.warnings.length} material warning(s)</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={!validationResult?.isValid || isImporting || (!projectId && !createNew && !selectedProjectId)}
          >
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
