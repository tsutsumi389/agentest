# Prismaマイグレーション履歴リセット

## Context

OSS公開に向けて、SaaS時代の26個のマイグレーション履歴（課金モデルの追加・削除等）をクリーンアップし、現在のスキーマ状態を表す単一の初期マイグレーションに統合する。

## 手順

### 1. 既存マイグレーションの削除

`packages/db/prisma/migrations/20*` を全削除（`migration_lock.toml` は保持）。

### 2. DB リセット＆初期マイグレーション生成

```bash
# DBをリセット（全テーブル削除）
docker compose exec dev pnpm --filter @agentest/db prisma migrate reset --force

# 現在のスキーマから初期マイグレーションを生成・適用
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name init
```

`prisma migrate dev --name init` が空のDBとスキーマを比較し、全CREATE文を含む単一の `migration.sql` を自動生成する。

## 対象ファイル

| パス | 操作 |
|------|------|
| `packages/db/prisma/migrations/20*_*/` (26個) | 削除 |
| `packages/db/prisma/migrations/migration_lock.toml` | 変更なし |
| `packages/db/prisma/migrations/<timestamp>_init/migration.sql` | 自動生成 |
| `packages/db/prisma/schema.prisma` | 変更なし |

## 検証

1. `prisma migrate status` で単一マイグレーションが applied であることを確認
2. `pnpm build` でビルド成功を確認
3. `pnpm test` でテスト通過を確認（テストDB側も必要に応じてリセット）
