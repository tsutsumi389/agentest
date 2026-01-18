import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Label } from '../../lib/api';

// プリセットカラー
const PRESET_COLORS = [
  '#EF4444', // 赤
  '#F97316', // オレンジ
  '#EAB308', // 黄
  '#22C55E', // 緑
  '#06B6D4', // シアン
  '#3B82F6', // 青
  '#8B5CF6', // 紫
  '#EC4899', // ピンク
  '#6B7280', // グレー
  '#1F2937', // ダークグレー
];

interface LabelFormModalProps {
  /** 編集対象のラベル（nullの場合は新規作成） */
  label?: Label | null;
  /** モーダルを閉じる */
  onClose: () => void;
  /** 保存時のコールバック */
  onSave: (data: { name: string; description: string | null; color: string }) => Promise<void>;
  /** モーダルが開いているか */
  isOpen: boolean;
}

/**
 * ラベル作成/編集モーダル
 */
export function LabelFormModal({ label, onClose, onSave, isOpen }: LabelFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!label;

  // 編集時は初期値を設定
  useEffect(() => {
    if (label) {
      setName(label.name);
      setDescription(label.description || '');
      setColor(label.color);
    } else {
      setName('');
      setDescription('');
      setColor('#3B82F6');
    }
    setError(null);
  }, [label, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('ラベル名を入力してください');
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setError('色はHEX形式（例: #FF5733）で指定してください');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        color: color.toUpperCase(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'ラベルを編集' : '新しいラベル'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-background-secondary rounded"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* エラー表示 */}
          {error && (
            <div className="p-3 bg-danger-subtle text-danger text-sm rounded">
              {error}
            </div>
          )}

          {/* ラベル名 */}
          <div>
            <label htmlFor="label-name" className="block text-sm font-medium mb-1">
              ラベル名 <span className="text-danger">*</span>
            </label>
            <input
              id="label-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="例: 回帰テスト"
              className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
              disabled={isSubmitting}
            />
          </div>

          {/* 説明 */}
          <div>
            <label htmlFor="label-description" className="block text-sm font-medium mb-1">
              説明
            </label>
            <textarea
              id="label-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="このラベルの用途を説明..."
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* 色 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              色 <span className="text-danger">*</span>
            </label>

            {/* プリセットカラー */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color.toUpperCase() === presetColor
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  aria-label={`色: ${presetColor}`}
                  disabled={isSubmitting}
                />
              ))}
            </div>

            {/* カスタムカラー入力 */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 p-1 bg-transparent border border-border rounded cursor-pointer"
                disabled={isSubmitting}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#FFFFFF"
                pattern="^#[0-9A-Fa-f]{6}$"
                className="flex-1 px-3 py-2 bg-background border border-border rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                disabled={isSubmitting}
              />
            </div>

            {/* プレビュー */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-foreground-subtle">プレビュー:</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: color,
                  color: getContrastTextColor(color),
                }}
              >
                {name || 'ラベル名'}
              </span>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm border border-border rounded hover:bg-background-secondary disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : isEditing ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 色の明るさを計算して適切なテキスト色を返す
 */
function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
