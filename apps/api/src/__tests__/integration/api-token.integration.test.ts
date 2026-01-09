import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

describe('API Token Integration Tests', () => {
  let app: Express;
  let testUser: { id: string; email: string };
  const tokenPrefix = 'test-api-token-';

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await prisma.apiToken.deleteMany({
      where: { name: { startsWith: tokenPrefix } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: tokenPrefix } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 既存のテストデータをクリーンアップ
    await prisma.apiToken.deleteMany({
      where: { name: { startsWith: tokenPrefix } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: tokenPrefix } },
    });

    // テストユーザーを作成
    testUser = await prisma.user.create({
      data: {
        email: `${tokenPrefix}${Date.now()}@example.com`,
        name: 'Test User',
      },
    });
  });

  describe('POST /internal/api/api-token/validate', () => {
    describe('認証', () => {
      it('X-Internal-Api-Keyがない場合は403を返す', async () => {
        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .send({ token: 'agentest_test' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('internal API key');
      });

      it('不正なX-Internal-Api-Keyの場合は403を返す', async () => {
        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', 'wrong-secret')
          .send({ token: 'agentest_test' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('バリデーション', () => {
      it('tokenがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('トークン検証', () => {
      it('無効なプレフィックスのトークンはvalid: falseを返す', async () => {
        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: 'invalid_prefix_token' });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });

      it('短すぎるトークンはvalid: falseを返す', async () => {
        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: 'agentest_short' });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });

      it('存在しないトークンはvalid: falseを返す', async () => {
        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: 'agentest_' + 'a'.repeat(43) });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });

      it('有効なトークンで認証成功', async () => {
        // 生トークンを生成
        const rawTokenBody = crypto.randomBytes(32).toString('base64url');
        const rawToken = `agentest_${rawTokenBody}`;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        // DBのtokenPrefixは10文字制限
        const tokenPfx = rawToken.substring(0, 10);

        // トークンをDBに作成
        await prisma.apiToken.create({
          data: {
            userId: testUser.id,
            name: `${tokenPrefix}valid-token`,
            tokenHash,
            tokenPrefix: tokenPfx,
            scopes: ['*'],
          },
        });

        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: rawToken });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
        expect(response.body.userId).toBe(testUser.id);
        expect(response.body.scopes).toEqual(['*']);
        expect(response.body.tokenId).toBeDefined();
      });

      it('失効済みトークンはvalid: falseを返す', async () => {
        // 生トークンを生成
        const rawTokenBody = crypto.randomBytes(32).toString('base64url');
        const rawToken = `agentest_${rawTokenBody}`;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        // DBのtokenPrefixは10文字制限
        const tokenPfx = rawToken.substring(0, 10);

        // 失効済みトークンをDBに作成
        await prisma.apiToken.create({
          data: {
            userId: testUser.id,
            name: `${tokenPrefix}revoked-token`,
            tokenHash,
            tokenPrefix: tokenPfx,
            scopes: ['*'],
            revokedAt: new Date(),
          },
        });

        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: rawToken });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });

      it('期限切れトークンはvalid: falseを返す', async () => {
        // 生トークンを生成
        const rawTokenBody = crypto.randomBytes(32).toString('base64url');
        const rawToken = `agentest_${rawTokenBody}`;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        // DBのtokenPrefixは10文字制限
        const tokenPfx = rawToken.substring(0, 10);

        // 期限切れトークンをDBに作成
        await prisma.apiToken.create({
          data: {
            userId: testUser.id,
            name: `${tokenPrefix}expired-token`,
            tokenHash,
            tokenPrefix: tokenPfx,
            scopes: ['*'],
            expiresAt: new Date('2020-01-01'),
          },
        });

        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: rawToken });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });

      it('削除済みユーザーのトークンはvalid: falseを返す', async () => {
        // 削除済みユーザーを作成
        const deletedUser = await prisma.user.create({
          data: {
            email: `${tokenPrefix}deleted-${Date.now()}@example.com`,
            name: 'Deleted User',
            deletedAt: new Date(),
          },
        });

        // 生トークンを生成
        const rawTokenBody = crypto.randomBytes(32).toString('base64url');
        const rawToken = `agentest_${rawTokenBody}`;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        // DBのtokenPrefixは10文字制限
        const tokenPfx = rawToken.substring(0, 10);

        // トークンをDBに作成
        await prisma.apiToken.create({
          data: {
            userId: deletedUser.id,
            name: `${tokenPrefix}deleted-user-token`,
            tokenHash,
            tokenPrefix: tokenPfx,
            scopes: ['*'],
          },
        });

        const response = await request(app)
          .post('/internal/api/api-token/validate')
          .set('X-Internal-Api-Key', env.INTERNAL_API_SECRET)
          .send({ token: rawToken });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });
    });
  });
});
