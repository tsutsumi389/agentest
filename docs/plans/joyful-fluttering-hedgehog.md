# テストスイート実行履歴画面の機能追加

## 概要

実行履歴一覧画面に以下の2つの機能を追加する：
1. **環境によるフィルター**: 実行履歴を環境でフィルタリング
2. **期待結果の状況バー**: 各実行の期待結果ステータス（PASS/FAIL/SKIPPED/PENDING）を示すプログレスバー

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/validators/schemas.ts` | `executionSearchSchema`に`environmentId`追加 |
| `apps/api/src/services/test-suite.service.ts` | 環境フィルタ + `judgmentCounts`集計追加 |
| `apps/web/src/lib/api.ts` | 型定義更新 |
| `apps/web/src/components/execution/ExecutionHistoryList.tsx` | 環境フィルタUI + プログレスバー追加 |
| 呼び出し元コンポーネント | `projectId`プロパティ追加 |

---

## 実装詳細

### 1. バックエンド

#### 1.1 スキーマ変更 (`packages/shared/src/validators/schemas.ts`)

```typescript
export const executionSearchSchema = z.object({
  // 既存フィールド...
  environmentId: z.string().uuid().optional(),  // 追加
});
```

#### 1.2 サービス変更 (`apps/api/src/services/test-suite.service.ts`)

`getExecutions`メソッドを修正：
- `options`に`environmentId?: string`を追加
- where句に環境フィルタを追加
- 各実行の`expectedResults`を取得し、ステータスを集計

```typescript
// レスポンスに追加される形式
judgmentCounts: {
  PASS: number;
  FAIL: number;
  PENDING: number;
  SKIPPED: number;
}
```

### 2. フロントエンド

#### 2.1 型定義更新 (`apps/web/src/lib/api.ts`)

```typescript
export interface ExecutionSearchParams {
  environmentId?: string;  // 追加
  // 既存フィールド...
}

export interface Execution {
  // 既存フィールド...
  judgmentCounts?: {
    PASS: number;
    FAIL: number;
    PENDING: number;
    SKIPPED: number;
  };
}
```

#### 2.2 実行履歴一覧コンポーネント (`ExecutionHistoryList.tsx`)

**Props変更**:
```typescript
interface ExecutionHistoryListProps {
  testSuiteId: string;
  projectId: string;  // 追加（環境一覧取得用）
}
```

**追加機能**:
1. `projectsApi.getEnvironments(projectId)`で環境一覧を取得
2. 環境フィルタのセレクトボックスを追加（日付フィルタの横）
3. `ExecutionItem`にプログレスバーを追加

**プログレスバー表示**:
- 既存の`ProgressBar`コンポーネントを使用
- PASS（緑）、FAIL（赤）、SKIPPED（グレー）を表示
- PENDING は背景色（未塗り部分）として表現

---

## 実装順序

```
1. バックエンド
   ├── schemas.ts: environmentId追加
   └── test-suite.service.ts: フィルタ + judgmentCounts集計

2. フロントエンド型定義
   └── api.ts: ExecutionSearchParams, Execution型更新

3. フロントエンドUI
   └── ExecutionHistoryList.tsx: 環境フィルタUI + ProgressBar追加

4. 呼び出し元修正
   └── projectIdプロパティを渡すよう修正
```

---

## 検証方法

1. Docker環境で開発サーバーを起動
2. テストスイートの実行履歴画面にアクセス
3. 環境フィルタで絞り込みが動作することを確認
4. 各実行履歴行にプログレスバーが表示されることを確認
5. プログレスバーの色が期待結果のステータスと一致することを確認
