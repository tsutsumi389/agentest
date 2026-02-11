import { prisma, type UserPlan } from '@agentest/db';

/**
 * ユーザーリポジトリ
 */
export class UserRepository {
  /**
   * IDでユーザーを検索
   */
  async findById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * メールでユーザーを検索
   */
  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * ユーザーを更新
   */
  async update(id: string, data: { name?: string; avatarUrl?: string | null }) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * ユーザーのプランを更新
   */
  async updatePlan(id: string, plan: UserPlan) {
    return prisma.user.update({
      where: { id },
      data: { plan },
    });
  }

  /**
   * ユーザーを論理削除
   */
  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * IDでユーザーを検索（パスワードハッシュ含む）
   * TOTP無効化時のパスワード検証用
   */
  async findByIdWithPassword(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        totpEnabled: true,
        passwordHash: true,
      },
    });
  }

  /**
   * TOTPを有効化し、暗号化済み秘密鍵を保存
   */
  async enableTotp(id: string, totpSecret: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        totpSecret,
        totpEnabled: true,
      },
    });
  }

  /**
   * TOTPを無効化（秘密鍵をnullに）
   */
  async disableTotp(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        totpSecret: null,
        totpEnabled: false,
      },
    });
  }

  /**
   * TOTP秘密鍵を取得（検証用）
   */
  async getTotpSecret(id: string): Promise<string | null> {
    const user = await prisma.user.findFirst({
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
