/**
 * 順序付けのためのFractional Indexキーを生成
 * 後続の全要素を更新せずに並び替えを可能にする
 */
export function generateOrderKey(prevKey: string | null, nextKey: string | null): string {
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const BASE = CHARS.length;

  if (!prevKey && !nextKey) {
    return 'a';
  }

  if (!prevKey) {
    // 最初の要素の前に挿入
    const firstChar = nextKey!.charCodeAt(0);
    if (firstChar > CHARS.charCodeAt(0)) {
      return String.fromCharCode(firstChar - 1);
    }
    return CHARS[0] + 'a';
  }

  if (!nextKey) {
    // 最後の要素の後に挿入
    const lastChar = prevKey.charCodeAt(prevKey.length - 1);
    if (lastChar < CHARS.charCodeAt(BASE - 1)) {
      return prevKey.slice(0, -1) + String.fromCharCode(lastChar + 1);
    }
    return prevKey + 'a';
  }

  // 2つの要素の間に挿入
  let i = 0;
  while (i < prevKey.length && i < nextKey.length && prevKey[i] === nextKey[i]) {
    i++;
  }

  const prefix = prevKey.slice(0, i);

  if (i < prevKey.length && i < nextKey.length) {
    const prevCharIndex = CHARS.indexOf(prevKey[i]);
    const nextCharIndex = CHARS.indexOf(nextKey[i]);
    if (nextCharIndex - prevCharIndex > 1) {
      return prefix + CHARS[Math.floor((prevCharIndex + nextCharIndex) / 2)];
    }
    return prefix + prevKey[i] + 'a';
  }

  if (i < nextKey.length) {
    const nextCharIndex = CHARS.indexOf(nextKey[i]);
    if (nextCharIndex > 0) {
      return prefix + CHARS[Math.floor(nextCharIndex / 2)];
    }
  }

  return prevKey + 'a';
}

/**
 * 指定ミリ秒間スリープする
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指数バックオフでリトライする
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 100, maxDelay = 5000, factor = 2 } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxAttempts) {
        break;
      }
      await sleep(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * オブジェクトから指定キーを除外する
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * オブジェクトから指定キーのみ抽出する
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * タイムスタンプ文字列を生成（ファイル名用）
 * 形式: YYYYMMDD-HHmmss
 */
export function generateTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}
