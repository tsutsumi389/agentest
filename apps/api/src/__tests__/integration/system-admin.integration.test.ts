import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@agentest/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createApp } from '../../app.js';
import { hashToken } from '../../utils/pkce.js';
import type { Express } from 'express';

describe('System Admin API Integration Tests', () => {
  let app: Express;
  let superAdminCookie: string;
  let adminCookie: string;
  let superAdminId: string;
  let adminId: string;
  let testAdminId: string;

  beforeAll(async () => {
    // Expressアプリを作成
    app = createApp();
    // テスト用SUPER_ADMINを作成
    const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 12);
    const superAdmin = await prisma.adminUser.create({
      data: {
        email: 'super-admin-test@example.com',
        passwordHash: superAdminPassword,
        name: 'Test Super Admin',
        role: 'SUPER_ADMIN',
      },
    });
    superAdminId = superAdmin.id;

    // テスト用ADMINを作成
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    const admin = await prisma.adminUser.create({
      data: {
        email: 'admin-test@example.com',
        passwordHash: adminPassword,
        name: 'Test Admin',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;

    // SUPER_ADMINセッションを作成（生トークンをクッキーに、ハッシュをDBに保存）
    const superAdminRawToken = crypto.randomBytes(32).toString('hex');
    await prisma.adminSession.create({
      data: {
        adminUserId: superAdminId,
        tokenHash: hashToken(superAdminRawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    superAdminCookie = `admin_session=${superAdminRawToken}`;

    // ADMINセッションを作成
    const adminRawToken = crypto.randomBytes(32).toString('hex');
    await prisma.adminSession.create({
      data: {
        adminUserId: adminId,
        tokenHash: hashToken(adminRawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    adminCookie = `admin_session=${adminRawToken}`;
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await prisma.adminInvitation.deleteMany({
      where: { invitedById: superAdminId },
    });
    await prisma.adminSession.deleteMany({
      where: { adminUserId: { in: [superAdminId, adminId, testAdminId].filter(Boolean) } },
    });
    await prisma.adminAuditLog.deleteMany({
      where: { adminUserId: { in: [superAdminId, adminId, testAdminId].filter(Boolean) } },
    });
    await prisma.adminUser.deleteMany({
      where: { id: { in: [superAdminId, adminId, testAdminId].filter(Boolean) } },
    });
  });

  beforeEach(async () => {
    // テスト用の一時管理者がいれば削除
    if (testAdminId) {
      await prisma.adminAuditLog.deleteMany({ where: { targetId: testAdminId } });
      await prisma.adminSession.deleteMany({ where: { adminUserId: testAdminId } });
      await prisma.adminUser.deleteMany({ where: { id: testAdminId } });
      testAdminId = '';
    }
  });

  describe('GET /admin/admin-users', () => {
    it('SUPER_ADMINは一覧を取得できる', async () => {
      const response = await request(app)
        .get('/admin/admin-users')
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('adminUsers');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.adminUsers)).toBe(true);
    });

    it('ADMINは一覧を取得できない（403）', async () => {
      const response = await request(app)
        .get('/admin/admin-users')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
    });

    it('認証なしではアクセスできない（401）', async () => {
      const response = await request(app).get('/admin/admin-users');

      expect(response.status).toBe(401);
    });

    it('検索フィルタが正しく動作する', async () => {
      const response = await request(app)
        .get('/admin/admin-users')
        .query({ q: 'super-admin', role: 'SUPER_ADMIN' })
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body.adminUsers.length).toBeGreaterThanOrEqual(1);
    });

    it('ページネーションが正しく動作する', async () => {
      const response = await request(app)
        .get('/admin/admin-users')
        .query({ page: 1, limit: 1 })
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /admin/admin-users/:id', () => {
    it('SUPER_ADMINは詳細を取得できる', async () => {
      const response = await request(app)
        .get(`/admin/admin-users/${superAdminId}`)
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('adminUser');
      expect(response.body.adminUser.id).toBe(superAdminId);
      expect(response.body.adminUser).toHaveProperty('activity');
      expect(response.body.adminUser).toHaveProperty('recentAuditLogs');
    });

    it('存在しないIDでは404を返す', async () => {
      const response = await request(app)
        .get('/admin/admin-users/00000000-0000-0000-0000-000000000000')
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(404);
    });

    it('無効なIDでは400を返す', async () => {
      const response = await request(app)
        .get('/admin/admin-users/invalid-id')
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /admin/admin-users', () => {
    it('SUPER_ADMINは新しい管理者を招待できる', async () => {
      const response = await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'new-admin@example.com',
          name: 'New Admin',
          role: 'VIEWER',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('adminUser');
      expect(response.body.adminUser.email).toBe('new-admin@example.com');
      expect(response.body.adminUser.role).toBe('VIEWER');
      expect(response.body).toHaveProperty('invitationSent');

      // 招待が作成されていることを確認
      const invitation = await prisma.adminInvitation.findFirst({
        where: { email: 'new-admin@example.com' },
      });
      expect(invitation).not.toBeNull();
    });

    it('既存のメールアドレスではエラーを返す', async () => {
      const response = await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'super-admin-test@example.com',
          name: 'Duplicate',
          role: 'ADMIN',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ADMIN_USER_ALREADY_EXISTS');
    });

    it('必須フィールドがない場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'incomplete@example.com',
        });

      expect(response.status).toBe(400);
    });

    it('有効な招待が既に存在する場合はエラーを返す', async () => {
      // 最初の招待を作成
      await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'duplicate-invite@example.com',
          name: 'Duplicate Invite',
          role: 'VIEWER',
        });

      // 同じメールアドレスで再度招待しようとする
      const response = await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'duplicate-invite@example.com',
          name: 'Duplicate Invite',
          role: 'VIEWER',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVITATION_ALREADY_EXISTS');
    });
  });

  describe('GET /admin/admin-users/invitations/:token', () => {
    it('有効な招待情報を取得できる（認証不要）', async () => {
      // 招待を作成
      await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'invitation-test@example.com',
          name: 'Invitation Test',
          role: 'ADMIN',
        });

      const invitation = await prisma.adminInvitation.findFirst({
        where: { email: 'invitation-test@example.com' },
      });

      const response = await request(app)
        .get(`/admin/admin-users/invitations/${invitation!.token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('invitation-test@example.com');
      expect(response.body.name).toBe('Invitation Test');
      expect(response.body.role).toBe('ADMIN');
      expect(response.body).toHaveProperty('invitedBy');
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('存在しないトークンでは404を返す', async () => {
      const response = await request(app)
        .get('/admin/admin-users/invitations/invalid-token-12345');

      expect(response.status).toBe(404);
    });

    it('期限切れの招待ではエラーを返す', async () => {
      // 期限切れの招待を作成
      const expiredInvitation = await prisma.adminInvitation.create({
        data: {
          email: 'expired@example.com',
          name: 'Expired User',
          role: 'VIEWER',
          token: crypto.randomBytes(16).toString('hex'),
          invitedById: superAdminId,
          expiresAt: new Date(Date.now() - 1000), // 過去の日時
        },
      });

      const response = await request(app)
        .get(`/admin/admin-users/invitations/${expiredInvitation.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVITATION_EXPIRED');

      // クリーンアップ
      await prisma.adminInvitation.delete({ where: { id: expiredInvitation.id } });
    });
  });

  describe('POST /admin/admin-users/invitations/:token/accept', () => {
    it('招待を受諾してアカウントを作成できる（認証不要）', async () => {
      // 招待を作成
      await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'accept-test@example.com',
          name: 'Accept Test',
          role: 'VIEWER',
        });

      const invitation = await prisma.adminInvitation.findFirst({
        where: { email: 'accept-test@example.com' },
      });

      // 招待を受諾
      const response = await request(app)
        .post(`/admin/admin-users/invitations/${invitation!.token}/accept`)
        .send({
          password: 'StrongPassword123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.adminUser.email).toBe('accept-test@example.com');
      expect(response.body.adminUser.name).toBe('Accept Test');
      expect(response.body).toHaveProperty('message');

      // アカウントが作成されていることを確認
      const adminUser = await prisma.adminUser.findUnique({
        where: { email: 'accept-test@example.com' },
      });
      expect(adminUser).not.toBeNull();
      testAdminId = adminUser!.id;

      // 招待が受諾済みになっていることを確認
      const updatedInvitation = await prisma.adminInvitation.findUnique({
        where: { id: invitation!.id },
      });
      expect(updatedInvitation?.acceptedAt).not.toBeNull();
    });

    it('弱いパスワードではバリデーションエラーを返す', async () => {
      // 招待を作成
      await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'weak-password@example.com',
          name: 'Weak Password Test',
          role: 'VIEWER',
        });

      const invitation = await prisma.adminInvitation.findFirst({
        where: { email: 'weak-password@example.com' },
      });

      // 弱いパスワードで受諾を試みる
      const response = await request(app)
        .post(`/admin/admin-users/invitations/${invitation!.token}/accept`)
        .send({
          password: 'weak',
        });

      expect(response.status).toBe(400);
    });

    it('既に受諾済みの招待ではエラーを返す', async () => {
      // 招待を作成して受諾
      await request(app)
        .post('/admin/admin-users')
        .set('Cookie', superAdminCookie)
        .send({
          email: 'already-accepted@example.com',
          name: 'Already Accepted',
          role: 'VIEWER',
        });

      const invitation = await prisma.adminInvitation.findFirst({
        where: { email: 'already-accepted@example.com' },
      });

      // 1回目の受諾
      await request(app)
        .post(`/admin/admin-users/invitations/${invitation!.token}/accept`)
        .send({
          password: 'StrongPassword123!',
        });

      // 2回目の受諾を試みる
      const response = await request(app)
        .post(`/admin/admin-users/invitations/${invitation!.token}/accept`)
        .send({
          password: 'AnotherPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');

      // クリーンアップ
      const adminUser = await prisma.adminUser.findUnique({
        where: { email: 'already-accepted@example.com' },
      });
      if (adminUser) {
        testAdminId = adminUser.id;
      }
    });
  });

  describe('PATCH /admin/admin-users/:id', () => {
    it('SUPER_ADMINは他の管理者の名前を変更できる', async () => {
      const response = await request(app)
        .patch(`/admin/admin-users/${adminId}`)
        .set('Cookie', superAdminCookie)
        .send({
          name: 'Updated Admin Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.adminUser.name).toBe('Updated Admin Name');

      // 元に戻す
      await request(app)
        .patch(`/admin/admin-users/${adminId}`)
        .set('Cookie', superAdminCookie)
        .send({ name: 'Test Admin' });
    });

    it('自分自身のロールは変更できない', async () => {
      const response = await request(app)
        .patch(`/admin/admin-users/${superAdminId}`)
        .set('Cookie', superAdminCookie)
        .send({
          role: 'ADMIN',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANNOT_EDIT_SELF_ROLE');
    });
  });

  describe('DELETE /admin/admin-users/:id', () => {
    it('SUPER_ADMINは他の管理者を削除できる', async () => {
      // 削除対象の管理者を作成
      const toDelete = await prisma.adminUser.create({
        data: {
          email: 'to-delete@example.com',
          passwordHash: await bcrypt.hash('Delete123!', 12),
          name: 'To Delete',
          role: 'VIEWER',
        },
      });
      testAdminId = toDelete.id;

      const response = await request(app)
        .delete(`/admin/admin-users/${toDelete.id}`)
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('deletedAt');
    });

    it('自分自身は削除できない', async () => {
      const response = await request(app)
        .delete(`/admin/admin-users/${superAdminId}`)
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANNOT_DELETE_SELF');
    });
  });

  describe('POST /admin/admin-users/:id/unlock', () => {
    it('SUPER_ADMINはロックを解除できる', async () => {
      // ロックされた管理者を作成
      const lockedAdmin = await prisma.adminUser.create({
        data: {
          email: 'locked@example.com',
          passwordHash: await bcrypt.hash('Locked123!', 12),
          name: 'Locked Admin',
          role: 'VIEWER',
          failedAttempts: 5,
          lockedUntil: new Date(Date.now() + 3600000),
        },
      });
      testAdminId = lockedAdmin.id;

      const response = await request(app)
        .post(`/admin/admin-users/${lockedAdmin.id}/unlock`)
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('アカウントロックを解除しました');

      // ロックが解除されていることを確認
      const updated = await prisma.adminUser.findUnique({
        where: { id: lockedAdmin.id },
      });
      expect(updated?.lockedUntil).toBeNull();
      expect(updated?.failedAttempts).toBe(0);
    });
  });

  describe('POST /admin/admin-users/:id/reset-2fa', () => {
    it('SUPER_ADMINは2FAをリセットできる', async () => {
      // 2FA有効な管理者を作成
      const admin2FA = await prisma.adminUser.create({
        data: {
          email: '2fa-enabled@example.com',
          passwordHash: await bcrypt.hash('2FA123!', 12),
          name: '2FA Admin',
          role: 'VIEWER',
          totpEnabled: true,
          totpSecret: 'test-secret',
        },
      });
      testAdminId = admin2FA.id;

      const response = await request(app)
        .post(`/admin/admin-users/${admin2FA.id}/reset-2fa`)
        .set('Cookie', superAdminCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2FA設定をリセットしました');

      // 2FAがリセットされていることを確認
      const updated = await prisma.adminUser.findUnique({
        where: { id: admin2FA.id },
      });
      expect(updated?.totpEnabled).toBe(false);
      expect(updated?.totpSecret).toBeNull();
    });
  });
});
