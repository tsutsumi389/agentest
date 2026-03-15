import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';

// バリデーション定数
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_EVIDENCES_PER_RESULT = 10;
const ALLOWED_MIME_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
];

// MIMEタイプのマッチング（ワイルドカード対応）
function isAllowedMimeType(fileType: string): boolean {
  return ALLOWED_MIME_TYPES.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return fileType.startsWith(prefix + '/');
    }
    return fileType === pattern;
  });
}

interface ExecutionEvidenceUploadProps {
  /** 現在のエビデンス件数 */
  currentCount: number;
  /** アップロード中フラグ */
  isUploading: boolean;
  /** アップロードハンドラ */
  onUpload: (file: File, description?: string) => void;
}

/**
 * ファイルサイズを人間が読みやすい形式にフォーマット
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * エビデンスアップロードコンポーネント
 */
export function ExecutionEvidenceUpload({
  currentCount,
  isUploading,
  onUpload,
}: ExecutionEvidenceUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLimitReached = currentCount >= MAX_EVIDENCES_PER_RESULT;

  // ファイルバリデーション
  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `ファイルサイズが上限（${formatFileSize(MAX_FILE_SIZE)}）を超えています`;
    }
    if (!isAllowedMimeType(file.type)) {
      return '許可されていないファイル形式です';
    }
    return null;
  }, []);

  // ファイル選択処理
  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setSelectedFile(file);
    },
    [validateFile]
  );

  // ドラッグイベント
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLimitReached && !isUploading) {
        setIsDragOver(true);
      }
    },
    [isLimitReached, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isLimitReached || isUploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [isLimitReached, isUploading, handleFileSelect]
  );

  // input変更時
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // アップロード実行
  const handleUpload = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, description || undefined);
    // アップロード開始後にクリア（成功/失敗は親コンポーネントで処理）
    setSelectedFile(null);
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // キャンセル
  const handleCancel = () => {
    setSelectedFile(null);
    setDescription('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 上限到達時の表示
  if (isLimitReached) {
    return (
      <div className="mt-2 px-3 py-2 bg-warning-subtle rounded-lg">
        <div className="flex items-center gap-2 text-xs text-warning">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>エビデンスの上限（{MAX_EVIDENCES_PER_RESULT}件）に達しています</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {/* エラー表示 */}
      {error && (
        <div className="px-3 py-2 bg-danger-subtle rounded-lg">
          <div className="flex items-center gap-2 text-xs text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto p-0.5 hover:bg-danger/20 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ファイル選択済みの場合 */}
      {selectedFile ? (
        <div className="px-3 py-2 bg-background-secondary rounded-lg border border-border">
          <div className="flex items-center gap-3">
            {/* ファイル情報 */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-foreground-muted">{formatFileSize(selectedFile.size)}</p>
            </div>

            {/* キャンセルボタン */}
            {!isUploading && (
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 text-foreground-muted hover:text-foreground rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 説明入力 */}
          <div className="mt-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明（オプション）"
              className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-border-focus"
              disabled={isUploading}
            />
          </div>

          {/* アップロードボタン */}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="px-3 py-1 text-xs font-medium bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3" />
                  アップロード
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ドラッグ&ドロップエリア */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            px-3 py-3 border border-dashed rounded-lg text-center cursor-pointer transition-colors
            ${
              isDragOver
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-border-focus hover:bg-background-secondary'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleInputChange}
            className="hidden"
            accept={ALLOWED_MIME_TYPES.join(',')}
            disabled={isUploading}
          />
          <Upload className="w-5 h-5 text-foreground-muted mx-auto mb-1" />
          <p className="text-xs text-foreground-muted">ファイルをドラッグ&ドロップ</p>
          <p className="text-xs text-foreground-muted">
            または<span className="text-accent">クリックして選択</span>
          </p>
          <p className="text-xs text-foreground-muted mt-1">
            最大 {formatFileSize(MAX_FILE_SIZE)} / 残り {MAX_EVIDENCES_PER_RESULT - currentCount}件
          </p>
        </div>
      )}
    </div>
  );
}
