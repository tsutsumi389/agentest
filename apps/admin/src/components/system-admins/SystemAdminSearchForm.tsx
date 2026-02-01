import { Search } from 'lucide-react';
import { useState, useCallback } from 'react';

interface SystemAdminSearchFormProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * システム管理者検索フォーム
 */
export function SystemAdminSearchForm({ value, onChange }: SystemAdminSearchFormProps) {
  const [inputValue, setInputValue] = useState(value);

  // デバウンス付き検索
  const handleChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      // 入力が落ち着いてから検索
      const timeoutId = setTimeout(() => {
        onChange(newValue);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [onChange]
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="メール・名前で検索..."
        className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      />
    </div>
  );
}
