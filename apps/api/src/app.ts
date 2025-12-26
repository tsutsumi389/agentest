import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { configurePassport } from '@agentest/auth';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiLimiter, authLimiter } from './middleware/rate-limiter.js';
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
  configurePassport(authConfig, async (profile) => {
    // OAuth コールバック処理は auth.routes.ts で行う
    return { userId: '', email: profile.email };
  });

  // レート制限
  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  // ルート
  app.use(routes);

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
