import multer from 'multer';

/**
 * 許可するMIMEタイプ
 */
export const ALLOWED_MIME_TYPES = [
  // 画像
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  // 動画
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  // 音声
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  // ドキュメント
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
];

/**
 * 最大ファイルサイズ (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * 1期待結果あたりのエビデンス上限数
 */
export const MAX_EVIDENCES_PER_RESULT = 10;

/**
 * MIMEタイプが許可されているかチェック
 */
export function isAllowedMimeType(mimeType: string): boolean {
  // 完全一致チェック
  if (ALLOWED_MIME_TYPES.includes(mimeType)) {
    return true;
  }

  // image/*, video/*, audio/* のワイルドカードマッチ
  const [type] = mimeType.split('/');
  if (['image', 'video', 'audio'].includes(type)) {
    return true;
  }

  return false;
}

/**
 * エビデンスアップロード用multerミドルウェア
 */
export const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, callback) => {
    if (isAllowedMimeType(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('許可されていないファイル形式です'));
    }
  },
});
