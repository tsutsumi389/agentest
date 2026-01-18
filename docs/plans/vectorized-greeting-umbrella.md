# プロジェクト詳細ページ テストスイート一覧改善

## 概要
プロジェクト詳細ページのテストスイート一覧を改善する。

## 要件
1. ✅ ページネーション（既存実装済み）
2. 最終実行結果の表示
3. ラベル表示
4. ステータスは下書き/アーカイブのみ表示（アクティブは非表示）
5. 実行アイコン・3点リーダーの削除

---

## 実装計画

### Step 1: バックエンドAPI拡張

**ファイル**: `apps/api/src/repositories/test-suite.repository.ts`

`search`メソッドの`include`を拡張して、ラベルと最終実行情報を取得:

```typescript
include: {
  createdByUser: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { testCases: true, preconditions: true } },
  // 追加: ラベル情報
  testSuiteLabels: {
    include: {
      label: { select: { id: true, name: true, color: true } },
    },
    orderBy: { label: { name: 'asc' } },
  },
  // 追加: 最終実行情報（最新1件）
  executions: {
    orderBy: { startedAt: 'desc' },
    take: 1,
    select: { id: true, status: true, startedAt: true, completedAt: true },
  },
},
```

### Step 2: コントローラーでレスポンス整形

**ファイル**: `apps/api/src/controllers/project.controller.ts`

`getTestSuites`メソッドでフロントエンド向けに整形:
- `testSuiteLabels` → `labels` に変換
- `executions` → `lastExecution` に変換

### Step 3: フロントエンド型定義更新

**ファイル**: `apps/web/src/lib/api.ts`

`TestSuite`型に追加:
```typescript
labels?: Array<{ id: string; name: string; color: string }>;
lastExecution?: {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
  startedAt: string;
  completedAt: string | null;
} | null;
```

### Step 4: TestSuiteRowコンポーネント修正

**ファイル**: `apps/web/src/pages/ProjectDetail.tsx` (行460-530)

1. **import修正**: `Play`, `MoreHorizontal`を削除
2. **ステータス表示変更**: ACTIVEの場合はバッジ非表示
3. **ラベル表示追加**: スイート名の横にラベルバッジを表示
4. **最終実行結果追加**: テストケース数の横に実行ステータス表示
5. **ボタン削除**: Playボタン(行507-516)と3点リーダー(行518-526)を削除

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/repositories/test-suite.repository.ts` | includeにラベル・実行情報追加 |
| `apps/api/src/controllers/project.controller.ts` | レスポンス整形 |
| `apps/web/src/lib/api.ts` | TestSuite型拡張 |
| `apps/web/src/pages/ProjectDetail.tsx` | TestSuiteRow修正 |

---

## 検証方法

1. `docker compose exec dev pnpm build` でビルド確認
2. `docker compose exec dev pnpm test` でテスト実行
3. ブラウザでプロジェクト詳細ページを開き、以下を確認:
   - ラベルが表示されること
   - 最終実行結果（完了/実行中/中断）が表示されること
   - ACTIVEステータスのスイートにバッジが表示されないこと
   - DRAFT/ARCHIVEDステータスにはバッジが表示されること
   - 実行ボタンと3点リーダーが消えていること
