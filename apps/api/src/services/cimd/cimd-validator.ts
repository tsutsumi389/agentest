import { z } from 'zod';

/**
 * CIMD メタデータドキュメントの zod スキーマと CIMD 固有検証。
 *
 * 仕様: draft-ietf-oauth-client-id-metadata-document-00
 * - メタデータ JSON 内 `client_id` プロパティとフェッチ URL は完全一致でなければならない
 * - 対称鍵認証 (client_secret_*) は禁止
 * - `redirect_uris` 必須・配列
 */

export class CimdValidationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CimdValidationError';
  }
}

// 対称鍵を使う auth method は CIMD では禁止
const FORBIDDEN_AUTH_METHODS = new Set([
  'client_secret_basic',
  'client_secret_post',
  'client_secret_jwt',
]);

const cimdMetadataSchema = z
  .object({
    client_id: z.string().url(),
    client_name: z.string().min(1).max(200).optional(),
    redirect_uris: z.array(z.string().url()).min(1),
    grant_types: z
      .array(z.string())
      .default(['authorization_code'])
      .refine(
        (arr) => arr.every((g) => g === 'authorization_code' || g === 'refresh_token'),
        'unsupported grant_type'
      ),
    response_types: z
      .array(z.string())
      .default(['code'])
      .refine((arr) => arr.every((r) => r === 'code'), 'unsupported response_type'),
    token_endpoint_auth_method: z.string().default('none'),
    scope: z.string().optional(),
    client_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
    software_id: z.string().max(255).optional(),
    software_version: z.string().max(50).optional(),
    jwks_uri: z.string().url().optional(),
  })
  .passthrough();

export type CimdMetadata = z.infer<typeof cimdMetadataSchema>;

/**
 * フェッチした CIMD JSON を検証する。
 *
 * @param raw - フェッチした JSON（unknown）
 * @param fetchUrl - フェッチに使用した URL（client_id と一致する必要がある）
 * @returns 検証済みのメタデータ
 * @throws CimdValidationError 検証失敗時
 */
export function validateCimdMetadata(raw: unknown, fetchUrl: string): CimdMetadata {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CimdValidationError('CIMD metadata must be a JSON object');
  }

  // client_secret プロパティ自体を拒否（公開ドキュメントに秘密鍵を含めるべきでない）
  if ('client_secret' in raw) {
    throw new CimdValidationError(
      'CIMD metadata MUST NOT contain client_secret (symmetric secrets are forbidden)'
    );
  }

  const parsed = cimdMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CimdValidationError(
      `CIMD metadata schema invalid: ${parsed.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`
    );
  }

  const data = parsed.data;

  // 仕様必須: メタデータ内 client_id とフェッチ URL の完全一致
  if (data.client_id !== fetchUrl) {
    throw new CimdValidationError(
      `client_id (${data.client_id}) does not match fetch URL (${fetchUrl})`
    );
  }

  if (FORBIDDEN_AUTH_METHODS.has(data.token_endpoint_auth_method)) {
    throw new CimdValidationError(
      `token_endpoint_auth_method "${data.token_endpoint_auth_method}" is forbidden in CIMD (symmetric secrets)`
    );
  }

  return data;
}
