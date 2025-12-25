# Agentest WebSocket サーバー 本番用 Dockerfile
# マルチステージビルドで最適化

# ===========================================
# ステージ1: 依存関係のインストール
# ===========================================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# パッケージマネージャーファイルをコピー
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ws-types/package.json ./packages/ws-types/

# 依存関係をインストール（本番用）
RUN pnpm install --frozen-lockfile --prod=false

# ===========================================
# ステージ2: ビルド
# ===========================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# 依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/ws/node_modules ./apps/ws/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/ws-types/node_modules ./packages/ws-types/node_modules

# ソースコードをコピー
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/ws ./apps/ws
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/auth ./packages/auth
COPY packages/ws-types ./packages/ws-types

# Prismaクライアントを生成
RUN pnpm --filter @agentest/db exec prisma generate

# ビルド
RUN pnpm --filter @agentest/ws build

# ===========================================
# ステージ3: 本番イメージ
# ===========================================
FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

# 非rootユーザーを作成
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 agentest

# 必要なファイルをコピー
COPY --from=builder --chown=agentest:nodejs /app/apps/ws/dist ./apps/ws/dist
COPY --from=builder --chown=agentest:nodejs /app/apps/ws/package.json ./apps/ws/
COPY --from=builder --chown=agentest:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=agentest:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=agentest:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=agentest:nodejs /app/packages/db/package.json ./packages/db/
COPY --from=builder --chown=agentest:nodejs /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder --chown=agentest:nodejs /app/packages/auth/package.json ./packages/auth/
COPY --from=builder --chown=agentest:nodejs /app/packages/ws-types/dist ./packages/ws-types/dist
COPY --from=builder --chown=agentest:nodejs /app/packages/ws-types/package.json ./packages/ws-types/
COPY --from=builder --chown=agentest:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=agentest:nodejs /app/packages/db/node_modules/.prisma ./packages/db/node_modules/.prisma

# ユーザーを切り替え
USER agentest

# 環境変数
ENV NODE_ENV=production
ENV WS_PORT=3002

EXPOSE 3002

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# アプリケーションを起動
CMD ["node", "apps/ws/dist/index.js"]
