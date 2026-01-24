import { PrismaClient, AdminRoleType } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('管理者ユーザーのシード処理を開始...');

  // パスワードハッシュのコストファクター（admin-auth.serviceと同じ値）
  const BCRYPT_ROUNDS = 12;

  // ===== 管理者ユーザーをシード =====
  const adminPasswordHash = bcryptjs.hashSync('password123', BCRYPT_ROUNDS);
  const adminUser = await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      name: 'テスト管理者',
      role: AdminRoleType.SUPER_ADMIN,
      totpEnabled: false,
      failedAttempts: 0,
    },
  });

  console.log('管理者ユーザーを作成:', adminUser.email);

  console.log('管理者ユーザーのシード処理が完了しました!');
}

main()
  .catch((e) => {
    console.error('管理者シード処理でエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
