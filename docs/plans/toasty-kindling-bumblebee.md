# テストスイート更新MCPツールへのgroupId追加計画

## 概要

テストスイートの更新MCPツールに変更時のグループIDを付与する機能を追加する。
テストケースの変更MCPツール（`update-test-case.ts`）の実装パターンを踏襲する。

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/mcp-server/src/tools/update-test-suite.ts` | groupId生成・送信追加 |
| `apps/api/src/routes/internal.ts` | スキーマ・エンドポイント修正 |

## 実装ステップ

### Step 1: MCPツール層の修正
**ファイル**: `apps/mcp-server/src/tools/update-test-suite.ts`

- `crypto` モジュールのインポート追加（行1付近）
- ハンドラー内（行52付近）でgroupId生成・API呼び出しに含める

### Step 2: API層スキーマ修正
**ファイル**: `apps/api/src/routes/internal.ts` (行695-701)

- `updateTestSuiteBodySchema` に `groupId: z.string().uuid().optional()` 追加
- refine関数でgroupIdを除外してバリデーション（テストケースと同じパターン）

### Step 3: APIエンドポイント修正
**ファイル**: `apps/api/src/routes/internal.ts` (行834, 847付近)

- リクエストボディからgroupIdを分離
- `testSuiteService.update()` に `{ groupId }` オプション引数を渡す

## 検証方法

```bash
docker compose exec dev pnpm build
docker compose exec dev pnpm test
```
