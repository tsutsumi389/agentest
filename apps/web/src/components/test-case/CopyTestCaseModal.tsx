import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Copy } from 'lucide-react';
import { testCasesApi, ApiError, type TestCase } from '../../lib/api';

interface CopyTestCaseModalProps {
  isOpen: boolean;
  testCase: TestCase;
  testSuiteId: string;
  onClose: () => void;
  onCopied?: (newTestCase: TestCase) => void;
}

/**
 * テストケースコピーモーダル
 */
export function CopyTestCaseModal({
  isOpen,
  testCase,
  testSuiteId: _testSuiteId,
  onClose,
  onCopied,
}: CopyTestCaseModalProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルオープン時に初期値をセット
  useEffect(() => {
    if (isOpen) {
      setTitle(`${testCase.title} のコピー`);
      setError(null);
    }
  }, [isOpen, testCase.title]);

  // フォーカス設定
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // バリデーション
  const validate = (): boolean => {
    if (!title.trim()) {
      setError('タイトルは必須です');
      return false;
    }
    if (title.length > 200) {
      setError('タイトルは200文字以内で入力してください');
      return false;
    }
    return true;
  };

  // コピー実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await testCasesApi.copy(testCase.id, { title: title.trim() });
      onCopied?.(response.testCase);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('コピーに失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">テストケースをコピー</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コピー元表示 */}
        <div className="mb-4 p-3 bg-background-secondary rounded-lg">
          <p className="text-xs text-foreground-muted mb-1">コピー元</p>
          <p className="text-sm font-medium text-foreground truncate">{testCase.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* タイトル */}
          <div>
            <label htmlFor="copy-title" className="block text-sm font-medium text-foreground mb-1">
              タイトル <span className="text-danger">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="copy-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              className={`input w-full ${error ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="コピー後のタイトルを入力"
              disabled={isSubmitting}
            />
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
          </div>

          {/* ヘルプテキスト */}
          <p className="text-xs text-foreground-subtle">
            前提条件、テスト手順、期待結果もすべてコピーされます。
          </p>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'コピー中...' : 'コピー'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
