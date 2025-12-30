import {
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  FileArchive,
  Download,
  Trash2,
  Loader2,
  Paperclip,
} from 'lucide-react';
import type { ExecutionEvidence } from '../../lib/api';

interface ExecutionEvidenceListProps {
  /** エビデンス一覧 */
  evidences: ExecutionEvidence[];
  /** 編集可能か */
  isEditable: boolean;
  /** 削除中のエビデンスID */
  deletingId: string | null;
  /** ダウンロードURL取得中のエビデンスID */
  downloadingId: string | null;
  /** 削除ハンドラ */
  onDelete: (evidenceId: string) => void;
  /** ダウンロードハンドラ */
  onDownload: (evidenceId: string) => void;
}

/**
 * ファイルサイズを人間が読みやすい形式にフォーマット
 */
function formatFileSize(bytes: string | number): string {
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(size)) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = size;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * ファイルタイプに応じたアイコンを返す
 */
function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) {
    return FileImage;
  }
  if (fileType.startsWith('video/')) {
    return FileVideo;
  }
  if (fileType.startsWith('audio/')) {
    return FileAudio;
  }
  if (fileType === 'application/pdf' || fileType.startsWith('text/')) {
    return FileText;
  }
  if (fileType === 'application/zip' || fileType.includes('archive')) {
    return FileArchive;
  }
  return File;
}

/**
 * 画像ファイルかどうか判定
 */
function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}

/**
 * 実行エビデンス一覧コンポーネント
 */
export function ExecutionEvidenceList({
  evidences,
  isEditable,
  deletingId,
  downloadingId,
  onDelete,
  onDownload,
}: ExecutionEvidenceListProps) {
  // エビデンスがない場合は何も表示しない
  if (evidences.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <Paperclip className="w-3 h-3" />
        <span>添付ファイル ({evidences.length})</span>
      </div>

      {/* エビデンス一覧 */}
      <div className="flex flex-wrap gap-2">
        {evidences.map((evidence) => {
          const FileIcon = getFileIcon(evidence.fileType);
          const isImage = isImageFile(evidence.fileType);
          const isDeleting = deletingId === evidence.id;
          const isDownloading = downloadingId === evidence.id;

          return (
            <div
              key={evidence.id}
              className="group relative flex items-center gap-2 px-3 py-2 bg-background-secondary rounded-lg border border-border hover:border-border-focus transition-colors"
            >
              {/* アイコン/サムネイル */}
              {isImage ? (
                <div className="w-8 h-8 rounded overflow-hidden bg-background-tertiary flex-shrink-0">
                  {/* サムネイル表示（MinIOからの署名付きURLが必要なので、fileUrlは使用しない） */}
                  <div className="w-full h-full flex items-center justify-center">
                    <FileImage className="w-4 h-4 text-foreground-muted" />
                  </div>
                </div>
              ) : (
                <FileIcon className="w-5 h-5 text-foreground-muted flex-shrink-0" />
              )}

              {/* ファイル情報 */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate max-w-32" title={evidence.fileName}>
                  {evidence.fileName}
                </p>
                <p className="text-xs text-foreground-muted">
                  {formatFileSize(evidence.fileSize)}
                </p>
              </div>

              {/* アクションボタン */}
              <div className="flex items-center gap-1">
                {/* ダウンロードボタン */}
                <button
                  type="button"
                  onClick={() => onDownload(evidence.id)}
                  disabled={isDownloading}
                  className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors disabled:opacity-50"
                  title="ダウンロード"
                  aria-label={`${evidence.fileName}をダウンロード`}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>

                {/* 削除ボタン（編集可能時のみ） */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => onDelete(evidence.id)}
                    disabled={isDeleting}
                    className="p-1.5 text-foreground-muted hover:text-danger hover:bg-danger-subtle rounded transition-colors disabled:opacity-50"
                    title="削除"
                    aria-label={`${evidence.fileName}を削除`}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* 説明（ある場合はツールチップで表示） */}
              {evidence.description && (
                <span
                  className="sr-only"
                  title={evidence.description}
                >
                  {evidence.description}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
