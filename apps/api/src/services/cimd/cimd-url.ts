/**
 * CIMD (Client ID Metadata Document) URL の判定・検証。
 *
 * draft-ietf-oauth-client-id-metadata-document-00 に従い、CIMD client_id は
 * HTTPS URL であり、fragment や userinfo を含まず、識別子となる pathname を持つ。
 */

export class CimdUrlError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CimdUrlError';
  }
}

/**
 * 与えられた client_id が CIMD URL であるかを判定する。
 *
 * UUID 形式（DCR 経路）と区別するため、URL でかつ https スキームの場合のみ true を返す。
 */
export function isCimdClientId(clientId: string): boolean {
  if (!clientId) return false;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  return url.protocol === 'https:';
}

/**
 * CIMD URL としての要件を検証する。
 *
 * - https スキーム必須
 * - fragment が空 (CIMD 仕様: "MUST NOT contain a fragment")
 * - username/password が空
 * - pathname が "/" でないこと（識別子を含むべき）
 *
 * 検証に失敗した場合は CimdUrlError を投げる。成功時は正規化された URL を返す。
 */
export function validateCimdUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CimdUrlError('client_id is not a valid URL');
  }

  if (url.protocol !== 'https:') {
    throw new CimdUrlError('client_id MUST use https scheme');
  }
  if (url.hash !== '') {
    throw new CimdUrlError('client_id MUST NOT contain fragment');
  }
  if (url.username !== '' || url.password !== '') {
    throw new CimdUrlError('client_id MUST NOT contain userinfo');
  }
  if (url.pathname === '' || url.pathname === '/') {
    throw new CimdUrlError('client_id pathname MUST identify a specific resource');
  }
  return url;
}
