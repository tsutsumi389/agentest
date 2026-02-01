/**
 * 日付ユーティリティ
 * タイムゾーンを考慮した日付計算を提供
 */

// JST（日本標準時）のUTCオフセット（ミリ秒）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * JST基準で指定日の0時0分0秒のUTC Dateを取得
 * @param date 基準となる日付
 * @returns JSTの0時0分0秒に相当するUTC Date
 */
export function getJSTStartOfDay(date: Date): Date {
  // JSTに変換
  const jstTime = date.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstTime);

  // JSTで日付の0時0分0秒を計算
  const jstMidnight = new Date(
    Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate())
  );

  // UTCに戻す（-9時間）
  return new Date(jstMidnight.getTime() - JST_OFFSET_MS);
}

/**
 * JST基準で前日の開始時刻を取得
 * @param date 基準となる日付
 * @returns 前日の0時0分0秒（JST）に相当するUTC Date
 */
export function getJSTYesterdayStart(date: Date): Date {
  const todayStart = getJSTStartOfDay(date);
  return new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * JST基準で指定日が何曜日かを取得
 * @param date 基準となる日付
 * @returns 曜日（0=日曜, 1=月曜, ..., 6=土曜）
 */
export function getJSTDayOfWeek(date: Date): number {
  // JSTに変換して曜日を取得
  const jstTime = date.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstTime);
  return jstDate.getUTCDay();
}

/**
 * JST基準で指定日が月の何日目かを取得
 * @param date 基準となる日付
 * @returns 日（1-31）
 */
export function getJSTDayOfMonth(date: Date): number {
  const jstTime = date.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstTime);
  return jstDate.getUTCDate();
}

/**
 * JST基準で直近の月曜日の開始時刻を取得
 * @param date 基準となる日付
 * @returns 直近の月曜日の0時0分0秒（JST）に相当するUTC Date
 */
export function getJSTLastMonday(date: Date): Date {
  const todayStart = getJSTStartOfDay(date);
  const dayOfWeek = getJSTDayOfWeek(date);
  // 日曜(0)の場合は6日前、それ以外は (曜日-1) 日前
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(todayStart.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
}

/**
 * JST基準で前月の1日の開始時刻を取得
 * @param date 基準となる日付
 * @returns 前月1日の0時0分0秒（JST）に相当するUTC Date
 */
export function getJSTLastMonthStart(date: Date): Date {
  const jstTime = date.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstTime);
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();

  // 前月を計算
  const lastMonth = month === 0 ? 11 : month - 1;
  const lastMonthYear = month === 0 ? year - 1 : year;

  // 前月1日のJST 00:00:00
  const jstMidnight = new Date(Date.UTC(lastMonthYear, lastMonth, 1));
  return new Date(jstMidnight.getTime() - JST_OFFSET_MS);
}

/**
 * JST基準で当月の1日の開始時刻を取得
 * @param date 基準となる日付
 * @returns 当月1日の0時0分0秒（JST）に相当するUTC Date
 */
export function getJSTThisMonthStart(date: Date): Date {
  const jstTime = date.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstTime);
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();

  // 当月1日のJST 00:00:00
  const jstMidnight = new Date(Date.UTC(year, month, 1));
  return new Date(jstMidnight.getTime() - JST_OFFSET_MS);
}

/**
 * 日付をYYYY-MM-DD形式の文字列に変換（JST基準）
 * @param date 変換する日付
 * @returns YYYY-MM-DD形式の文字列
 */
export function formatDateStringJST(date: Date): string {
  const jstTime = date.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstTime);
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
