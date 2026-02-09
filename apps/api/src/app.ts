import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { configurePassport, type OAuthProfile } from '@agentest/auth';
import { prisma } from '@agentest/db';
import { env } from './config/env.js';
import { encryptToken } from './utils/crypto.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger, attachRequestId, runWithRequestContext } from './middleware/request-logger.js';
import { trackSession } from './middleware/session.middleware.js';
import routes from './routes/index.js';

/**
 * Expressアプリケーションを作成・設定
 */
export function createApp(): Express {
  const app = express();

  // セキュリティミドルウェア
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }));

  // CORS（/.well-knownエンドポイント含む全てのルートに適用）
  app.use(cors({
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'mcp-protocol-version'],
  }));

  // Stripe Webhookはraw bodyが必要（署名検証のため、express.json()より前に配置）
  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

  // ボディパーサー（Base64エンコードされたファイルアップロードのため50MBに設定）
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  // クッキーパーサー
  app.use(cookieParser());

  // セッション追跡
  app.use(trackSession());

  // リクエストログ（pino-http）
  app.use(httpLogger);
  app.use(attachRequestId);
  // attachRequestIdで設定されたreq.requestIdをAsyncLocalStorageで非同期処理全体に伝搬
  app.use(runWithRequestContext);

  // Passport設定
  const authConfig = {
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiry: env.JWT_ACCESS_EXPIRES_IN,
      refreshExpiry: env.JWT_REFRESH_EXPIRES_IN,
    },
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    },
    oauth: {
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
              callbackUrl: env.GITHUB_CALLBACK_URL,
            },
          }
        : {}),
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              callbackUrl: env.GOOGLE_CALLBACK_URL,
            },
          }
        : {}),
    },
  };
  configurePassport(
    authConfig,
    // OAuth認証コールバック（ログイン・新規登録用）
    // 連携追加モードの場合は、auth.controller.ts で profile 情報を使って処理
    async (profile: OAuthProfile) => {
      // OAuth プロバイダーからのプロフィール情報でユーザーを作成または取得

      // 既存のアカウント（OAuth連携）を検索
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        include: { user: true },
      });

      if (account) {
        // 既存ユーザーが見つかった場合
        return {
          userId: account.user.id,
          email: account.user.email,
          profile: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
          },
        };
      }

      // 同じメールアドレスの既存ユーザーを検索
      let user = await prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (!user) {
        // 新規ユーザーを作成（OAuthユーザーはメール確認済み）
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
          },
        });
      } else if (!user.emailVerified) {
        // 既存ユーザーがOAuthでログインした場合、未確認なら確認済みに更新
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }

      // OAuth アカウント連携を作成（トークンは暗号化して保存）
      await prisma.account.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: encryptToken(profile.accessToken, env.TOKEN_ENCRYPTION_KEY),
          refreshToken: encryptToken(profile.refreshToken, env.TOKEN_ENCRYPTION_KEY),
        },
      });

      return {
        userId: user.id,
        email: user.email,
        profile: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      };
    }
  );

  // ルート
  app.use(routes);

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
