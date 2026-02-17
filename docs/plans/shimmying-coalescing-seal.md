# OSS移行プラン 1-2: 課金関連バッチジョブ削除 - 残作業完了計画

## Context

OSS移行プラン（`docs/plans/jolly-crunching-pond.md`）のセクション1-2「課金関連バッチジョブ」の対応。コミット#231で大部分が実施済みだが、`stripe`依存関係の削除漏れがある。TDDアプローチで残作業を完了し、クリーンな状態を検証する。

## 現状分析

### 完了済み（コミット#231）
- [x] `subscription-sync.ts` ジョブ削除
- [x] `webhook-retry.ts` ジョブ削除
- [x] `payment-event-cleanup.ts` ジョブ削除
- [x] `lib/stripe.ts` 削除
- [x] 上記ジョブの全ユニットテスト削除
- [x] 上記ジョブの全統合テスト削除
- [x] `index.ts` のジョブ登録から削除済み
- [x] `test-helpers.ts` から課金関連ヘルパー削除済み
- [x] `history-cleanup.ts` はプラン判定なし（固定30日）で正常

### 未完了
- [ ] `apps/jobs/package.json` L19: `"stripe": "^20.2.0"` 依存関係が残存

---

## 実装手順（TDD: RED → GREEN → REFACTOR）

### Step 1: RED - 残留確認テスト

stripe関連コードが残存しないことを確認する。

```bash
# stripeへの参照がソースコード内にないことを確認
docker compose exec dev sh -c "grep -r 'stripe' apps/jobs/src/ --include='*.ts' || echo 'OK: stripe参照なし'"

# 現在のテストがすべて通ることを確認（ベースライン）
docker compose exec dev pnpm --filter @agentest/jobs test
```

### Step 2: GREEN - stripe依存関係の削除

**ファイル**: `apps/jobs/package.json`

```diff
  "dependencies": {
    "@agentest/db": "workspace:*",
    "@agentest/shared": "workspace:*",
    "ioredis": "catalog:",
-   "nodemailer": "^7.0.12",
-   "stripe": "^20.2.0"
+   "nodemailer": "^7.0.12"
  },
```

```bash
# 依存関係を再インストール
docker compose exec dev pnpm install
```

### Step 3: REFACTOR - ビルド・テスト検証

```bash
# ユニットテスト
docker compose exec dev pnpm --filter @agentest/jobs test

# ビルド
docker compose exec dev pnpm --filter @agentest/jobs build

# lint
docker compose exec dev pnpm --filter @agentest/jobs lint
```

### Step 4: 最終確認

```bash
# 全体ビルド（他パッケージへの影響がないことを確認）
docker compose exec dev pnpm build

# 全体テスト
docker compose exec dev pnpm test
```

---

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/jobs/package.json` | `stripe` 依存関係を削除 |

## 検証方法

1. `pnpm --filter @agentest/jobs test` 全テスト通過
2. `pnpm --filter @agentest/jobs build` ビルド成功
3. `pnpm build` 全パッケージビルド成功
4. `grep -r 'stripe' apps/jobs/src/` で0件
