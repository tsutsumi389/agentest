import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { StatusConfig, StatusOption } from '../../lib/execution-status';

interface StatusButtonProps<T extends string> {
  /** 現在のステータス値 */
  value: T;
  /** 現在のステータス設定 */
  config: StatusConfig;
  /** ステータス選択肢一覧 */
  options: StatusOption<T>[];
  /** ステータス変更時のハンドラ */
  onChange: (value: T) => void;
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中フラグ */
  isUpdating: boolean;
  /** アクセシビリティ用ラベル */
  ariaLabel?: string;
}

/**
 * ステータス変更ボタン（ドロップダウン）
 */
export function StatusButton<T extends string>({
  value,
  config,
  options,
  onChange,
  isEditable,
  isUpdating,
  ariaLabel = 'ステータスを変更',
}: StatusButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリック・ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const IconComponent = config.icon;

  // 編集不可の場合はアイコンとラベルのみ表示
  if (!isEditable) {
    return (
      <div className="flex items-center gap-1.5">
        <IconComponent className={`w-4 h-4 ${config.colorClass}`} />
        <span className={`text-sm ${config.colorClass}`}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded border border-border
          hover:bg-background-tertiary transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        disabled={isUpdating}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
        ) : (
          <IconComponent className={`w-4 h-4 ${config.colorClass}`} />
        )}
        <span className={`text-sm ${config.colorClass}`}>{config.label}</span>
        <ChevronDown className="w-3 h-3 text-foreground-muted" />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 min-w-[120px] bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="listbox"
          aria-activedescendant={`status-option-${value}`}
        >
          {options.map((option) => {
            const OptionIcon = option.config.icon;
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                id={`status-option-${option.value}`}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                  ${isSelected ? 'bg-background-tertiary' : 'hover:bg-background-tertiary'}
                `}
                onClick={() => {
                  if (option.value !== value) {
                    onChange(option.value);
                  }
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <OptionIcon className={`w-4 h-4 ${option.config.colorClass}`} />
                <span className={option.config.colorClass}>{option.config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
