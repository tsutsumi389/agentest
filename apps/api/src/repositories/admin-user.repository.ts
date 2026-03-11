import { prisma } from '@agentest/db';

/**
 * 管理者ユーザーリポジトリ
 */
export class AdminUserRepository {
  /**
   * メールアドレスで管理者を検索（パスワードハッシュ含む）
   */
  async findByEmailWithPassword(email: string) {
    return prisma.adminUser.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * IDで管理者を検索（パスワードなし）
   */
  async findById(id: string) {
    return prisma.adminUser.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpEnabled: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * IDで管理者を検索（パスワードハッシュ含む）
   * TOTP無効化時のパスワード検証用
   */
  async findByIdWithPassword(id: string) {
    return prisma.adminUser.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpEnabled: true,
        passwordHash: true,
      },
    });
  }

  /**
   * ログイン失敗回数をインクリメント
   * @returns 更新後の failedAttempts を含むオブジェクト
   */
  async incrementFailedAttempts(id: string) {
    return prisma.adminUser.update({
      where: { id },
      data: {
        failedAttempts: { increment: 1 },
      },
      select: {
        id: true,
        failedAttempts: true,
      },
    });
  }

  /**
   * アカウントをロック
   */
  async lockAccount(id: string, until: Date) {
    return prisma.adminUser.update({
      where: { id },
      data: {
        lockedUntil: until,
      },
    });
  }

  /**
   * ログイン成功時に失敗回数とロックをリセット
   */
  async resetFailedAttempts(id: string) {
    return prisma.adminUser.update({
      where: { id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * TOTPを有効化し、秘密鍵を保存
   * @param id 管理者ユーザーID
   * @param totpSecret TOTP秘密鍵
   */
  async enableTotp(id: string, totpSecret: string): Promise<void> {
    await prisma.adminUser.update({
      where: { id },
      data: {
        totpSecret,
        totpEnabled: true,
      },
    });
  }

  /**
   * TOTPを無効化（秘密鍵をnullに）
   * @param id 管理者ユーザーID
   */
  async disableTotp(id: string): Promise<void> {
    await prisma.adminUser.update({
      where: { id },
      data: {
        totpSecret: null,
        totpEnabled: false,
      },
    });
  }

  /**
   * 名前を更新
   */
  async updateName(id: string, name: string) {
    return prisma.adminUser.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpEnabled: true,
      },
    });
  }

  /**
   * パスワードハッシュを更新
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.adminUser.update({
      where: { id },
      data: { passwordHash },
    });
  }

  /**
   * TOTP秘密鍵を取得（検証用）
   * @param id 管理者ユーザーID
   * @returns TOTP秘密鍵またはnull
   */
  async getTotpSecret(id: string): Promise<string | null> {
    const user = await prisma.adminUser.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        totpSecret: true,
      },
    });

    return user?.totpSecret ?? null;
  }
}
