/**
 * HTMLの特殊文字をエスケープする
 * XSS防止のため、HTMLテンプレートにユーザー入力を挿入する際に使用する
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * URLのプロトコルを検証する
 * href属性に挿入するURLがhttp/httpsであることを保証し、javascript: URI等を防止する
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`許可されないURLプロトコル: ${parsed.protocol}`);
    }
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('許可されない')) {
      throw error;
    }
    throw new Error(`不正なURL: ${url}`);
  }
}
