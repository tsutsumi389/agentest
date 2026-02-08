/**
 * リクエストコンテキスト（AsyncLocalStorage）
 *
 * HTTPリクエスト処理中に requestId を非同期処理全体に自動伝搬する。
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

/**
 * 現在のリクエストコンテキストから requestId を取得する
 * コンテキスト外では undefined を返す
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
