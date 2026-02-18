import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';

describe('GET /api/config', () => {
  let app: Express;

  beforeAll(async () => {
    app = createApp();
  });

  it('認証不要で200を返す', async () => {
    const response = await request(app).get('/api/config');

    expect(response.status).toBe(200);
  });

  it('auth.providers オブジェクトを含むレスポンスを返す', async () => {
    const response = await request(app).get('/api/config');

    expect(response.body).toHaveProperty('auth');
    expect(response.body.auth).toHaveProperty('providers');
    expect(response.body.auth.providers).toHaveProperty('github');
    expect(response.body.auth.providers).toHaveProperty('google');
    expect(typeof response.body.auth.providers.github).toBe('boolean');
    expect(typeof response.body.auth.providers.google).toBe('boolean');
  });

  it('auth.requireEmailVerification をboolean値で返す', async () => {
    const response = await request(app).get('/api/config');

    expect(response.body.auth).toHaveProperty('requireEmailVerification');
    expect(typeof response.body.auth.requireEmailVerification).toBe('boolean');
  });
});
