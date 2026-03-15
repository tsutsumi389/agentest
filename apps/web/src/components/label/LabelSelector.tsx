import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Label } from '../../lib/api';
import { LabelBadge } from '../ui/LabelBadge';

interface LabelSelectorProps {
  /** 利用可能なラベル一覧 */
  availableLabels: Label[];
  /** 選択されているラベルID一覧 */
  selectedLabelIds: string[];
  /** ラベル選択変更時のコールバック */
  onChange: (labelIds: string[]) => void;
  /** 無効化 */
  disabled?: boolean;
  /** プレースホルダー */
  placeholder?: string;
  /** カスタムクラス */
  className?: string;
}

/**
 * ラベル選択コンポーネント
 * ドロップダウンでラベルを選択できる
 */
export function LabelSelector({
  availableLabels,
  selectedLabelIds,
  onChange,
  disabled = false,
  placeholder = 'ラベルを選択...',
  className = '',
}: LabelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 選択されているラベルを取得
  const selectedLabels = availableLabels.filter((label) => selectedLabelIds.includes(label.id));

  // フィルタされたラベル一覧
  const filteredLabels = availableLabels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ラベルの選択/解除を切り替え
  const toggleLabel = (labelId: string) => {
    if (selectedLabelIds.includes(labelId)) {
      onChange(selectedLabelIds.filter((id) => id !== labelId));
    } else {
      onChange([...selectedLabelIds, labelId]);
    }
  };

  // 選択済みラベルを削除
  const removeLabel = (labelId: string) => {
    onChange(selectedLabelIds.filter((id) => id !== labelId));
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }
        }}
        disabled={disabled}
        className={`
          w-full min-h-[38px] px-3 py-2 flex items-center gap-2 flex-wrap
          bg-background border border-border rounded
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-foreground-subtle cursor-pointer'}
          focus:outline-none focus:ring-1 focus:ring-accent
        `}
      >
        {selectedLabels.length > 0 ? (
          selectedLabels.map((label) => (
            <LabelBadge
              key={label.id}
              label={label}
              removable={!disabled}
              onRemove={() => removeLabel(label.id)}
            />
          ))
        ) : (
          <span className="text-foreground-subtle text-sm">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 ml-auto text-foreground-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded shadow-lg max-h-60 overflow-hidden">
          {/* 検索入力 */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ラベルを検索..."
              className="w-full px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* ラベル一覧 */}
          <div className="overflow-y-auto max-h-48">
            {filteredLabels.length === 0 ? (
              <div className="p-3 text-sm text-foreground-subtle text-center">
                ラベルが見つかりません
              </div>
            ) : (
              filteredLabels.map((label) => {
                const isSelected = selectedLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className={`
                      w-full px-3 py-2 flex items-center gap-2 text-left
                      hover:bg-background-secondary transition-colors
                      ${isSelected ? 'bg-background-secondary' : ''}
                    `}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 truncate text-sm">{label.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
