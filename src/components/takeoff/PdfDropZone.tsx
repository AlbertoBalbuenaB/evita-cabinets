import { useRef, useState, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { ACCEPTED_FILE_TYPES, isAcceptedFile } from '../../lib/takeoff/pdfLoader';

interface PdfDropZoneProps {
  onFile: (file: File) => void;
}

export function PdfDropZone({ onFile }: PdfDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && isAcceptedFile(file)) onFile(file);
    },
    [onFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      className={`flex-1 flex items-center justify-center transition-colors ${
        dragging ? 'bg-blue-50/60' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          dragging
            ? 'border-blue-400 bg-blue-50/80'
            : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50/60'
        }`}
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
          dragging ? 'bg-blue-100' : 'bg-slate-100'
        }`}>
          {dragging ? (
            <FileText className="h-8 w-8 text-blue-500" />
          ) : (
            <Upload className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {dragging ? 'Drop your file here' : 'Drop a PDF or image here, or click to browse'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Supports PDF, PNG, JPG, WEBP, and other image formats</p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
