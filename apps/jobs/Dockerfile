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

RUN pnpm install --frozen-lockfile

# ソースコードのコピー
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/jobs apps/jobs
COPY tsconfig.base.json ./

# Prismaクライアントを生成してビルド
RUN pnpm --filter @agentest/db exec prisma generate
RUN pnpm --filter @agentest/db build
RUN pnpm --filter @agentest/shared build
RUN pnpm --filter @agentest/jobs build

# 本番イメージ
FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/jobs ./apps/jobs

WORKDIR /app/apps/jobs

CMD ["node", "dist/index.js"]
