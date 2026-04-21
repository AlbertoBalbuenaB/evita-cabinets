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
  allowCreate?: boolean;
  onCreateOption?: (value: string) => Promise<void>;
}

export function AutocompleteSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  required,
  allowCreate = false,
  onCreateOption,
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

  const showCreateOption = allowCreate && searchTerm && !filteredOptions.some(
    opt => opt.value.toLowerCase() === searchTerm.toLowerCase()
  );

  async function handleCreateOption() {
    if (searchTerm && onCreateOption) {
      await onCreateOption(searchTerm);
      onChange(searchTerm);
      setIsOpen(false);
      setSearchTerm('');
    }
  }

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
        <label className="block text-sm font-medium text-fg-700 mb-1">
          {label}
          {required && <span className="text-[color:var(--red-dot)] ml-1">*</span>}
        </label>
      )}

      <div
        className={`relative w-full border rounded-lg bg-surf-input text-fg-900 cursor-pointer transition-all ${
          isOpen
            ? 'border-accent-a ring-2 ring-focus'
            : 'border-border-input hover:border-border-solid'
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
              className="flex-1 outline-none bg-transparent text-fg-900 placeholder:text-fg-400"
              placeholder="Type to search..."
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`flex-1 ${
                selectedOption ? 'text-fg-900' : 'text-fg-400'
              }`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          )}

          <div className="flex items-center space-x-1">
            {value && !isOpen && (
              <button
                onClick={handleClear}
                className="p-1 hover:bg-surf-hover rounded transition-colors"
                type="button"
              >
                <X className="h-4 w-4 text-fg-400" />
              </button>
            )}
            <ChevronDown
              className={`h-4 w-4 text-fg-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surf-card border border-border-soft rounded-lg shadow-card max-h-64 overflow-auto">
          <div ref={listRef}>
            {filteredOptions.length > 0 ? (
              <>
                {filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`px-3 py-2 cursor-pointer transition-colors ${
                      index === highlightedIndex
                        ? 'bg-accent-tint-soft text-accent-text'
                        : 'text-fg-700 hover:bg-surf-hover'
                    } ${value === option.value ? 'bg-accent-tint-strong font-medium' : ''}`}
                  >
                    {option.label}
                  </div>
                ))}
                {showCreateOption && (
                  <div
                    onClick={handleCreateOption}
                    className="px-3 py-2 cursor-pointer bg-status-emerald-bg hover:bg-surf-hover text-status-emerald-fg font-medium border-t border-border-soft"
                  >
                    + Create "{searchTerm}"
                  </div>
                )}
              </>
            ) : showCreateOption ? (
              <div
                onClick={handleCreateOption}
                className="px-3 py-2 cursor-pointer bg-status-emerald-bg hover:bg-surf-hover text-status-emerald-fg font-medium"
              >
                + Create "{searchTerm}"
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-fg-500 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
