import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'api-key-auth' });

/**
 * APIキーのプレフィックス
 */
const TOKEN_PREFIX = 'agentest_';

/**
 * トークンの最小長
 * プレフィックス(9文字) + Base64URL 32バイト(約43文字) = 約52文字
 * 余裕を持って32文字以上を要求
 */
const MIN_TOKEN_LENGTH = TOKEN_PREFIX.length + 32;

/**
 * APIキー検証結果
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  organizationId?: string;
  scopes?: string[];
  tokenId?: string;
}

/**
 * APIキー認証サービス
 * API側の内部エンドポイントを呼び出してトークンを検証
 */
class ApiKeyAuthService {
  /**
   * APIキーを検証
   * @param rawToken 生のAPIキー（agentest_xxxxx形式）
   * @returns 検証結果
   */
  async validateToken(rawToken: string): Promise<ApiKeyValidationResult> {
    // プレフィックスと最小長チェック（不正なトークンでのAPI呼び出しを回避）
    if (!rawToken.startsWith(TOKEN_PREFIX) || rawToken.length < MIN_TOKEN_LENGTH) {
      return { valid: false };
    }

    try {
      // API側の内部エンドポイントを呼び出し
      const response = await fetch(`${env.API_INTERNAL_URL}/internal/api/api-token/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Api-Key': env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({ token: rawToken }),
      });

      if (!response.ok) {
        logger.error({ statusCode: response.status }, 'APIキー検証エラー');
        return { valid: false };
      }

      const result = await response.json() as ApiKeyValidationResult;
      return result;
    } catch (error) {
      logger.error({ err: error }, 'APIキー検証中にエラーが発生');
      return { valid: false };
    }
  }
}

// シングルトンインスタンス
export const apiKeyAuthService = new ApiKeyAuthService();
