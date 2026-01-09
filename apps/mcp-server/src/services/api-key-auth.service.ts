import { env } from '../config/env.js';

/**
 * APIキーのプレフィックス
 */
const TOKEN_PREFIX = 'agentest_';

/**
 * トークンの最小長（プレフィックス + Base64URL 32バイト = 9 + 32 = 41文字）
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
        console.error(`APIキー検証エラー: HTTP ${response.status}`);
        return { valid: false };
      }

      const result = await response.json() as ApiKeyValidationResult;
      return result;
    } catch (error) {
      console.error('APIキー検証中にエラーが発生:', error);
      return { valid: false };
    }
  }
}

// シングルトンインスタンス
export const apiKeyAuthService = new ApiKeyAuthService();
