import { createHash, randomBytes } from 'crypto';
import { NotFoundError, AuthorizationError, ValidationError } from '@agentest/shared';
import { ApiTokenRepository } from '../repositories/api-token.repository.js';

/**
 * APIキーのプレフィックス
 */
const TOKEN_PREFIX = 'agentest_';

/**
 * トークンの最小長（プレフィックス + Base64URL 32バイト = 9 + 43 = 52文字）
 */
const MIN_TOKEN_LENGTH = TOKEN_PREFIX.length + 32;

/**
 * APIトークンサービス
 * APIキーの作成、検証、失効を担当
 */
export class ApiTokenService {
  private tokenRepo = new ApiTokenRepository();

  /**
   * 生トークンをSHA-256でハッシュ化
   */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * 生トークンを生成
   * フォーマット: agentest_<32バイトのランダム値（Base64URL）>
   */
  private generateRawToken(): string {
    const randomPart = randomBytes(32).toString('base64url');
    return `${TOKEN_PREFIX}${randomPart}`;
  }

  /**
   * トークンを検証（MCP内部通信用）
   * @param rawToken 生のAPIキー（agentest_xxxxx形式）
   * @returns 検証結果（valid, userId, scopes）
   */
  async validateToken(rawToken: string): Promise<{
    valid: boolean;
    userId?: string;
    organizationId?: string;
    scopes?: string[];
    tokenId?: string;
  }> {
    // プレフィックスと最小長チェック（不正なトークンでのDB検索を回避）
    if (!rawToken.startsWith(TOKEN_PREFIX) || rawToken.length < MIN_TOKEN_LENGTH) {
      return { valid: false };
    }

    // ハッシュ化してDB検索
    const tokenHash = this.hashToken(rawToken);
    const apiToken = await this.tokenRepo.findByHash(tokenHash);

    if (!apiToken) {
      return { valid: false };
    }

    // ユーザーが削除されていないかチェック
    if (apiToken.userId && apiToken.user?.deletedAt) {
      return { valid: false };
    }

    // 組織が削除されていないかチェック
    if (apiToken.organizationId && apiToken.organization?.deletedAt) {
      return { valid: false };
    }

    // 最終使用日時を更新（非同期で実行、エラーは無視）
    this.tokenRepo.updateLastUsedAt(apiToken.id).catch(() => {
      // 最終使用日時の更新失敗は無視
    });

    return {
      valid: true,
      userId: apiToken.userId ?? undefined,
      organizationId: apiToken.organizationId ?? undefined,
      scopes: apiToken.scopes,
      tokenId: apiToken.id,
    };
  }

  /**
   * APIキーを作成
   * @param params 作成パラメータ
   * @returns 作成されたトークン情報（生トークンは一度だけ返却）
   */
  async createToken(params: {
    userId?: string;
    organizationId?: string;
    name: string;
    scopes?: string[];
    expiresAt?: Date;
  }): Promise<{
    id: string;
    name: string;
    tokenPrefix: string;
    rawToken: string; // 一度だけ返却される生トークン
    scopes: string[];
    expiresAt: Date | null;
    createdAt: Date;
  }> {
    // ユーザーまたは組織のどちらかが必須
    if (!params.userId && !params.organizationId) {
      throw new ValidationError('userId or organizationId is required');
    }

    // 生トークンを生成
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    // DBのtokenPrefixカラムはVarChar(10)
    const tokenPrefix = rawToken.slice(0, 10); // agentest_x

    // スコープのデフォルト値（フルアクセス）
    const scopes = params.scopes ?? ['*'];

    // DBに保存
    const apiToken = await this.tokenRepo.create({
      userId: params.userId,
      organizationId: params.organizationId,
      name: params.name,
      tokenHash,
      tokenPrefix,
      scopes,
      expiresAt: params.expiresAt,
    });

    return {
      id: apiToken.id,
      name: apiToken.name,
      tokenPrefix: apiToken.tokenPrefix,
      rawToken, // 生トークンは一度だけ返却
      scopes: apiToken.scopes,
      expiresAt: apiToken.expiresAt,
      createdAt: apiToken.createdAt,
    };
  }

  /**
   * APIキーを失効
   * @param id トークンID
   * @param userId 操作ユーザーID（権限チェック用）
   */
  async revokeToken(id: string, userId: string): Promise<void> {
    const apiToken = await this.tokenRepo.findById(id);

    if (!apiToken) {
      throw new NotFoundError('ApiToken', id);
    }

    // 権限チェック：自分のトークンか確認
    if (apiToken.userId !== userId) {
      throw new AuthorizationError('このAPIキーを削除する権限がありません');
    }

    // 既に失効済みの場合はエラー
    if (apiToken.revokedAt) {
      throw new ValidationError('このAPIキーは既に失効しています');
    }

    await this.tokenRepo.revoke(id);
  }

  /**
   * ユーザーのAPIキー一覧を取得
   * @param userId ユーザーID
   */
  async listTokens(userId: string): Promise<Array<{
    id: string;
    name: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }>> {
    const tokens = await this.tokenRepo.findByUserId(userId);

    return tokens.map((token) => ({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      revokedAt: token.revokedAt,
      createdAt: token.createdAt,
    }));
  }
}
