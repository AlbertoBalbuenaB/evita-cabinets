import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-fg-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`block w-full px-3 py-2 bg-surf-input text-fg-900 placeholder:text-fg-400 border border-border-input rounded-lg shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus:border-accent-a disabled:bg-surf-muted disabled:text-fg-400 ${
            error ? 'border-[color:var(--red-dot)] focus-visible:ring-[color:var(--red-dot)] focus:border-[color:var(--red-dot)]' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-[color:var(--red-dot)]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
