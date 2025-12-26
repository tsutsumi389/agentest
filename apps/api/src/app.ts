import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { configurePassport, type OAuthProfile } from '@agentest/auth';
import { prisma } from '@agentest/db';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiLimiter, authLimiter } from './middleware/rate-limiter.js';
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

  // CORS
  app.use(cors({
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ボディパーサー
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // クッキーパーサー
  app.use(cookieParser());

  // セッション追跡
  app.use(trackSession());

  // リクエストログ
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }
  app.use(requestLogger);

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
    // 通常のOAuth認証コールバック（ログイン・新規登録用）
    async (profile: OAuthProfile) => {
      // OAuth プロバイダーからのプロフィール情報でユーザーを作成または取得

      // 既存のアカウント（OAuth連携）を検索
      let account = await prisma.account.findUnique({
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
        return { userId: account.user.id, email: account.user.email };
      }

      // 同じメールアドレスの既存ユーザーを検索
      let user = await prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (!user) {
        // 新規ユーザーを作成
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          },
        });
      }

      // OAuth アカウント連携を作成
      await prisma.account.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });

      return { userId: user.id, email: user.email };
    },
    // OAuth連携追加コールバック（既存ユーザーへのプロバイダー追加用）
    async (userId: string, profile: OAuthProfile) => {
      // 同じプロバイダーアカウントが他のユーザーに紐づいていないか確認
      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      });

      if (existingAccount) {
        if (existingAccount.userId === userId) {
          // 同じユーザーに既に連携済み
          return { success: false, error: `この${profile.provider}アカウントは既に連携されています` };
        } else {
          // 別のユーザーに連携済み
          return { success: false, error: `この${profile.provider}アカウントは別のユーザーに連携されています` };
        }
      }

      // 同じユーザー・プロバイダーの組み合わせが存在しないか確認
      const duplicateProvider = await prisma.account.findUnique({
        where: {
          userId_provider: { userId, provider: profile.provider },
        },
      });

      if (duplicateProvider) {
        return { success: false, error: `${profile.provider}は既に別のアカウントで連携されています` };
      }

      // 新しい連携を作成
      await prisma.account.create({
        data: {
          userId,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });

      return { success: true };
    }
  );

  // レート制限
  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  // ルート
  app.use(routes);

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
