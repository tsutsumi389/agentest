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

# Docker COPYがpnpmのsymlink構造を解決できない問題を回避するため
# npm互換のフラットなnode_modules構造を使用
RUN echo "node-linker=hoisted" > .npmrc

# 依存関係をインストール
RUN pnpm install --frozen-lockfile --prod=false

# ===========================================
# ステージ2: ビルド
# ===========================================
FROM node:22-alpine AS builder

WORKDIR /app

# hoistedモードのルートnode_modulesにすべての依存が含まれる
COPY --from=deps /app/node_modules ./node_modules

# ソースコードをコピー
COPY tsconfig.base.json ./
COPY apps/ws ./apps/ws
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/auth ./packages/auth
COPY packages/ws-types ./packages/ws-types

# PATHにnode_modules/.binを追加（pnmを介さず直接ビルドコマンドを実行）
ENV PATH="/app/node_modules/.bin:$PATH"

# ワークスペースパッケージのシンボリックリンクを作成（tscのモジュール解決に必要）
RUN mkdir -p node_modules/@agentest && \
    ln -s ../../packages/shared node_modules/@agentest/shared && \
    ln -s ../../packages/db node_modules/@agentest/db && \
    ln -s ../../packages/auth node_modules/@agentest/auth && \
    ln -s ../../packages/ws-types node_modules/@agentest/ws-types

# Prismaクライアントを生成
RUN prisma generate --schema=packages/db/prisma/schema.prisma

# ワークスペースパッケージを依存順にビルド
RUN tsc -p packages/shared/tsconfig.json && \
    tsc -p packages/ws-types/tsconfig.json && \
    tsc -p packages/db/tsconfig.json && \
    tsc -p packages/auth/tsconfig.json && \
    tsc -p apps/ws/tsconfig.json

# ===========================================
# ステージ3: 本番イメージ
# ===========================================
FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

# 非rootユーザーを作成
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 agentest

# 外部依存パッケージ（hoistedなのでフラット構造、symlink問題なし）
COPY --from=builder --chown=agentest:nodejs /app/node_modules ./node_modules

# ビルド成果物とpackage.jsonをコピー
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

# ワークスペースパッケージのシンボリックリンクを作成
RUN mkdir -p node_modules/@agentest && \
    ln -s ../../packages/shared node_modules/@agentest/shared && \
    ln -s ../../packages/db node_modules/@agentest/db && \
    ln -s ../../packages/auth node_modules/@agentest/auth && \
    ln -s ../../packages/ws-types node_modules/@agentest/ws-types

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
