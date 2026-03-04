import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { BadRequestError } from '@agentest/shared';

/**
 * 許可するMIMEタイプ
 */
export const ALLOWED_MIME_TYPES = [
  // 画像
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // image/svg+xml は除外: XSSリスク（SVGにJavaScriptを埋め込める）
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
 * マジックバイト検証をスキップするテキスト系MIMEタイプ
 */
export const TEXT_BASED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
]);

/**
 * file-type が返すMIMEタイプとホワイトリストのMIMEタイプの等価マッピング
 */
export const MIME_EQUIVALENCES: Record<string, string> = {
  'audio/x-wav': 'audio/wav',
  'video/vnd.avi': 'video/x-msvideo',
};

/**
 * 最大ファイルサイズ (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * 1期待結果あたりのエビデンス上限数
 */
export const MAX_EVIDENCES_PER_RESULT = 10;

/**
 * MIMEタイプが許可されているかチェック（完全一致のみ）
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * ファイルのマジックバイトを検証し、宣言されたMIMEタイプと一致するか確認
 *
 * @throws BadRequestError マジックバイトが検出できない場合、またはMIMEタイプが一致しない場合
 */
export async function validateMagicBytes(
  buffer: Buffer,
  declaredMimeType: string
): Promise<void> {
  // テキスト系MIMEタイプはマジックバイトがないためスキップ
  if (TEXT_BASED_MIME_TYPES.has(declaredMimeType)) {
    return;
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    throw new BadRequestError(
      'ファイルの種別を検出できません。ファイルが破損しているか、許可されていない形式です'
    );
  }

  // 等価マッピングで正規化
  const normalizedMime = MIME_EQUIVALENCES[detected.mime] ?? detected.mime;

  if (normalizedMime !== declaredMimeType) {
    throw new BadRequestError(
      'ファイルの内容が宣言されたMIMEタイプと一致しません'
    );
  }
}

/**
 * ファイル名をサニタイズ（S3キーインジェクション対策）
 *
 * パス区切り文字、制御文字、危険な文字を除去し、安全なファイル名を返す。
 * Unicode文字（日本語等）は許可する。
 */
export function sanitizeFileName(fileName: string): string {
  // パス区切り文字を除去
  let sanitized = fileName.replace(/[/\\]/g, '_');
  // 制御文字・シェルメタ文字を除去（Unicode文字、英数字、ハイフン、アンダースコア、ドット、スペースを許可）
  sanitized = sanitized.replace(/[^\p{L}\p{N}.\-_ ]/gu, '_');
  // 連続するアンダースコアを1つに
  sanitized = sanitized.replace(/_+/g, '_');
  // 先頭・末尾のアンダースコア/スペースを除去
  sanitized = sanitized.replace(/^[_ ]+|[_ ]+$/g, '');
  // ダブルドット対策
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'unnamed_file';
  }
  // 長さ制限（200文字）
  return sanitized.slice(0, 200);
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
