# Agentest バッチジョブ 本番用 Dockerfile

# ビルドステージ
FROM node:22-alpine AS builder

WORKDIR /app

# pnpmインストール（バージョン固定で再現性を確保）
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# 依存関係のコピーとインストール
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/jobs/package.json apps/jobs/

# Docker COPYがpnpmのsymlink構造を解決できない問題を回避するため
# npm互換のフラットなnode_modules構造を使用
RUN echo "node-linker=hoisted" > .npmrc

RUN pnpm install --frozen-lockfile

# ソースコードのコピー
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/jobs apps/jobs
COPY tsconfig.base.json ./

# PATHにnode_modules/.binを追加
ENV PATH="/app/node_modules/.bin:$PATH"

# ワークスペースパッケージのシンボリックリンクを作成（tscのモジュール解決に必要）
RUN mkdir -p node_modules/@agentest && \
    ln -s ../../packages/shared node_modules/@agentest/shared && \
    ln -s ../../packages/db node_modules/@agentest/db

# Prismaクライアントを生成してビルド
RUN prisma generate --schema=packages/db/prisma/schema.prisma
RUN tsc -p packages/shared/tsconfig.json && \
    tsc -p packages/db/tsconfig.json && \
    tsc -p apps/jobs/tsconfig.json

# 本番イメージ
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/jobs/dist ./apps/jobs/dist
COPY --from=builder /app/apps/jobs/package.json ./apps/jobs/

# ワークスペースパッケージのシンボリックリンクを作成
RUN mkdir -p node_modules/@agentest && \
    ln -s ../../packages/shared node_modules/@agentest/shared && \
    ln -s ../../packages/db node_modules/@agentest/db

WORKDIR /app/apps/jobs

CMD ["node", "dist/index.js"]
