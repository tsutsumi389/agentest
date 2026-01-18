/**
 * 色の明るさを計算して適切なテキスト色を返す
 * WCAG基準に基づくコントラスト計算
 * @param hexColor HEX形式の色（#FFFFFF）
 * @returns 白または黒のHEXコード
 */
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 相対輝度を計算（WCAG基準）
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
