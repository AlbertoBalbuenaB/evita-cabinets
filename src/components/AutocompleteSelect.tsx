import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface AutocompleteSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function AutocompleteSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  required,
}: AutocompleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={`relative w-full border rounded-lg bg-white cursor-pointer transition-all ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center px-3 py-2">
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 outline-none"
              placeholder="Type to search..."
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`flex-1 ${
                selectedOption ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          )}

          <div className="flex items-center space-x-1">
            {value && !isOpen && (
              <button
                onClick={handleClear}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
                type="button"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-auto">
          <div ref={listRef}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-slate-50'
                  } ${value === option.value ? 'bg-blue-100 font-medium' : ''}`}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-slate-500 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
