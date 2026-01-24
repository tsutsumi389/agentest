import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface OrganizationSearchFormProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 組織検索フォーム
 */
export function OrganizationSearchForm({ value, onChange }: OrganizationSearchFormProps) {
  const [inputValue, setInputValue] = useState(value);

  // 外部からの値変更に追従
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // デバウンス付きで検索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, value, onChange]);

  // クリアボタン
  const handleClear = () => {
    setInputValue('');
    onChange('');
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="名前またはスラグで検索..."
        className="w-full pl-10 pr-10 py-2 bg-background-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
