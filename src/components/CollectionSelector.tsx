import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAllCollections } from '../lib/collectionManager';

interface CollectionSelectorProps {
  value: string;
  onChange: (collection: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
}

export function CollectionSelector({
  value,
  onChange,
  placeholder = 'Select or type collection name...',
  allowCreate = true,
}: CollectionSelectorProps) {
  const [collections, setCollections] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  async function loadCollections() {
    try {
      const data = await getAllCollections();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsSearching(true);
    if (allowCreate) {
      onChange(newValue);
    }
    setIsOpen(true);
  }

  function handleSelectCollection(collection: string) {
    setInputValue(collection);
    setIsSearching(false);
    onChange(collection);
    setIsOpen(false);
  }

  function handleBlur() {
    setTimeout(() => {
      setIsOpen(false);
      setIsSearching(false);
    }, 200);
  }

  function handleFocus() {
    setIsSearching(false);
    setIsOpen(true);
  }

  const filteredCollections = isSearching
    ? collections.filter((c) => c.toLowerCase().includes(inputValue.toLowerCase()))
    : collections;

  const showCreateOption =
    allowCreate &&
    inputValue.trim() !== '' &&
    !collections.some((c) => c.toLowerCase() === inputValue.toLowerCase());

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-fg-700 mb-1">
        Collection / Library
      </label>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
          disabled={loading}
        />
        <ChevronDown
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-fg-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surf-card border border-border-solid rounded-lg shadow-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-fg-500">Loading collections...</div>
          ) : (
            <>
              {filteredCollections.length > 0 ? (
                filteredCollections.map((collection) => (
                  <button
                    key={collection}
                    type="button"
                    onClick={() => handleSelectCollection(collection)}
                    className={`w-full text-left px-3 py-2 hover:bg-surf-muted text-sm ${
                      collection === value ? 'bg-accent-tint-soft text-accent-text font-medium' : 'text-fg-700'
                    }`}
                  >
                    {collection}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-fg-500">
                  {collections.length === 0 ? 'No collections yet' : 'No matching collections'}
                </div>
              )}

              {showCreateOption && (
                <button
                  type="button"
                  onClick={() => handleSelectCollection(inputValue)}
                  className="w-full text-left px-3 py-2 bg-accent-tint-soft hover:bg-accent-tint-soft text-sm text-accent-text font-medium border-t border-border-soft"
                >
                  Create &quot;{inputValue}&quot;
                </button>
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-fg-500">
        Organize products into custom libraries (e.g., &quot;2026 Catalog&quot;, &quot;Premium Line&quot;)
      </p>
    </div>
  );
}
