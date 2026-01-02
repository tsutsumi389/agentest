import { z } from 'zod';

/**
 * OAuth 2.1 リクエスト検証スキーマ
 */

// サポートするスコープ一覧
export const SUPPORTED_SCOPES = [
  'mcp:read',
  'mcp:write',
  'project:read',
  'project:write',
  'test-suite:read',
  'test-suite:write',
  'test-case:read',
  'test-case:write',
  'execution:read',
  'execution:write',
] as const;

/**
 * 動的クライアント登録リクエスト (RFC 7591)
 */
export const clientRegistrationSchema = z.object({
  client_name: z.string().min(1).max(100),
  redirect_uris: z.array(z.string().url()).min(1),
  grant_types: z.array(z.enum(['authorization_code'])).default(['authorization_code']),
  response_types: z.array(z.enum(['code'])).default(['code']),
  token_endpoint_auth_method: z.enum(['none']).default('none'),
  scope: z.string().optional(),
  client_uri: z.string().url().optional(),
  logo_uri: z.string().url().optional(),
  software_id: z.string().max(255).optional(),
  software_version: z.string().max(50).optional(),
});

export type ClientRegistrationInput = z.infer<typeof clientRegistrationSchema>;

/**
 * 認可リクエスト (/oauth/authorize)
 */
export const authorizeRequestSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().uuid(),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128), // Base64URL encoded SHA256
  code_challenge_method: z.literal('S256'),
  resource: z.string().url(), // RFC 8707: Resource Indicators
  state: z.string().min(1),
  scope: z.string().optional(),
});

export type AuthorizeRequestInput = z.infer<typeof authorizeRequestSchema>;

/**
 * トークンリクエスト (/oauth/token)
 */
export const tokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().uuid(),
  code_verifier: z.string().min(43).max(128), // RFC 7636: PKCE
  resource: z.string().url().optional(), // RFC 8707
});

export type TokenRequestInput = z.infer<typeof tokenRequestSchema>;

/**
 * トークンイントロスペクションリクエスト (RFC 7662)
 */
export const introspectionRequestSchema = z.object({
  token: z.string().min(1),
});

export type IntrospectionRequestInput = z.infer<typeof introspectionRequestSchema>;

/**
 * トークン失効リクエスト (RFC 7009)
 */
export const revokeRequestSchema = z.object({
  token: z.string().min(1),
  client_id: z.string().uuid().optional(),
});

export type RevokeRequestInput = z.infer<typeof revokeRequestSchema>;

/**
 * redirect_uriがlocalhost/127.0.0.1のみかを検証
 * CLIクライアント向けのセキュリティ要件
 */
export function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    const hostname = url.hostname;
    // localhost, 127.0.0.1, ::1 のみ許可
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * スコープ文字列をパースして検証
 */
export function parseAndValidateScopes(scopeString?: string): string[] {
  if (!scopeString) {
    return [];
  }

  const requestedScopes = scopeString.split(' ').filter(Boolean);
  const validScopes = requestedScopes.filter((s) =>
    SUPPORTED_SCOPES.includes(s as typeof SUPPORTED_SCOPES[number])
  );

  return validScopes;
}
