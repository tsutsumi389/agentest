import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';
import { getCachedTokenValidation, cacheTokenValidation } from '../lib/token-cache.js';

const logger = baseLogger.child({ module: 'token-introspection' });

/**
 * トークンイントロスペクション結果
 */
export interface IntrospectionResult {
  active: boolean;
  client_id?: string;
  sub?: string;       // ユーザーID
  scope?: string;
  aud?: string;       // Audience (RFC 8707)
  exp?: number;
  iat?: number;
}

/**
 * トークンイントロスペクションサービス
 * Authorization Serverのイントロスペクションエンドポイントを呼び出してトークンを検証
 */
export class TokenIntrospectionService {
  private introspectionUrl: string;

  constructor() {
    // Docker内部通信ではAPI_INTERNAL_URLを使用（localhost:3001ではなくapi:3001）
    this.introspectionUrl = `${env.API_INTERNAL_URL}/oauth/introspect`;
  }

  /**
   * トークンをイントロスペクト
   * 内部API認証 (INTERNAL_API_SECRET) を使用
   */
  async introspect(token: string): Promise<IntrospectionResult> {
    try {
      const response = await fetch(this.introspectionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Api-Key': env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        logger.error({ statusCode: response.status }, 'Token introspection failed');
        return { active: false };
      }

      const result = await response.json() as IntrospectionResult;
      return result;
    } catch (error) {
      logger.error({ err: error }, 'Token introspection error');
      return { active: false };
    }
  }

  /**
   * トークンを検証し、Audience（resource）が期待値と一致するか確認
   * キャッシュが有効な場合、同一トークンの再検証時はAPIコールをスキップ
   */
  async validateToken(token: string, expectedAudience?: string): Promise<{
    valid: boolean;
    userId?: string;
    scopes?: string[];
  }> {
    // キャッシュ確認
    const cached = await getCachedTokenValidation<{ userId: string; scopes: string[] }>('oauth', token);
    if (cached) {
      return { valid: true, ...cached };
    }

    const result = await this.introspect(token);

    if (!result.active) {
      // 無効トークンはキャッシュしない（ブルートフォース対策）
      return { valid: false };
    }

    // Audience検証 (RFC 8707)
    // 末尾スラッシュを正規化して比較
    // NOTE: ASがaudを返さない場合は検証をスキップ（ASの実装に依存）
    if (expectedAudience && result.aud) {
      const normalizedExpected = expectedAudience.replace(/\/$/, '');
      const normalizedActual = result.aud.replace(/\/$/, '');
      if (normalizedExpected !== normalizedActual) {
        logger.warn({ expected: expectedAudience, actual: result.aud }, 'Token audience mismatch');
        return { valid: false };
      }
    }

    const validationResult = {
      userId: result.sub,
      scopes: result.scope ? result.scope.split(' ') : [],
    };

    // TTL計算: min(トークン残存期間, 300秒)
    const maxTtl = 300;
    let ttl = maxTtl;
    if (result.exp) {
      const remaining = result.exp - Math.floor(Date.now() / 1000);
      ttl = Math.min(Math.max(remaining, 1), maxTtl);
    }

    // 有効な結果をキャッシュに保存
    await cacheTokenValidation('oauth', token, validationResult, ttl);

    return {
      valid: true,
      ...validationResult,
    };
  }
}

// デフォルトインスタンス
export const tokenIntrospectionService = new TokenIntrospectionService();
