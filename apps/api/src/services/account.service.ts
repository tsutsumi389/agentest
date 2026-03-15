import { NotFoundError, ValidationError } from '@agentest/shared';
import { AccountRepository } from '../repositories/account.repository.js';

/**
 * OAuth連携アカウントサービス
 */
export class AccountService {
  private accountRepo = new AccountRepository();

  /**
   * ユーザーのOAuth連携一覧を取得
   */
  async getAccounts(userId: string) {
    return this.accountRepo.findByUserId(userId);
  }

  /**
   * 特定のプロバイダー連携を取得
   */
  async getAccountByProvider(userId: string, provider: string) {
    const account = await this.accountRepo.findByUserIdAndProvider(userId, provider);
    if (!account) {
      throw new NotFoundError('Account', `${userId}/${provider}`);
    }
    return account;
  }

  /**
   * OAuth連携を解除
   *
   * ビジネスルール:
   * - 最低1つのOAuth連携は必須（解除時にチェック）
   */
  async unlinkAccount(userId: string, provider: string) {
    // 対象の連携が存在するか確認
    const account = await this.accountRepo.findByUserIdAndProvider(userId, provider);
    if (!account) {
      throw new NotFoundError('Account', `${userId}/${provider}`);
    }

    // 連携数をチェック（最低1つは必須）
    const accountCount = await this.accountRepo.countByUserId(userId);
    if (accountCount <= 1) {
      throw new ValidationError(
        '最低1つのOAuth連携が必要です。連携を解除する前に別のプロバイダーを連携してください。'
      );
    }

    // 連携を削除
    await this.accountRepo.delete(account.id);

    return { success: true };
  }

  /**
   * プロバイダーの連携可否をチェック
   *
   * ビジネスルール:
   * - 同一プロバイダーの重複連携は不可
   */
  async checkCanLink(userId: string, provider: string): Promise<boolean> {
    const existingAccount = await this.accountRepo.findByUserIdAndProvider(userId, provider);
    return !existingAccount;
  }
}
