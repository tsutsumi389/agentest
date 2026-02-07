/**
 * HTMLの特殊文字をエスケープする
 * XSS防止のため、HTMLテンプレートにユーザー入力を挿入する際に使用する
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
