import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    // アクセシビリティ: エラーとヘルパーテキストのID
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const helperId = helperText && !error && inputId ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`
            w-full px-3 py-2 text-sm
            bg-white border rounded-md
            placeholder:text-zinc-400
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed
            ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-zinc-300 focus:border-zinc-500 focus:ring-zinc-200'
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-zinc-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
