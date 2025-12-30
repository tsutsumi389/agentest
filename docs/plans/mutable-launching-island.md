# Phase 6: テスト実行機能 実装計画

## 概要

テスト実行機能（EX-001〜EX-007）を実装する。バックエンドの基本機能は実装済みのため、フロントエンドの拡張と追加機能の実装が主な作業となる。

## 現状の実装状況

### 実装済み ✓
- **バックエンド**
  - `TestSuiteService.startExecution()` - 実行開始、スナップショット作成
  - `ExecutionService` - 詳細取得、中止、完了、結果更新、エビデンスアップロード
  - ルーティング設定

- **フロントエンド**
  - `testSuitesApi.startExecution()` - API呼び出し
  - `Execution.tsx` - 実行ページの基本構造（ヘッダー、サマリーカード）

### 未実装
1. 環境選択モーダル
2. スナップショットに基づくテストケース表示
3. 前提条件/ステップ/期待値の結果更新UI
4. エビデンスファイルアップロードUI（ドラッグ&ドロップ対応）
5. 実行履歴一覧の拡張（フィルタ、ページネーション）
6. 実行権限チェックミドルウェア

---

## 実装ステップ

### Step 1: 実行開始・環境選択 (EX-001, EX-002, EX-003)

#### バックエンド
1. **権限ミドルウェア作成**
   - `apps/api/src/middleware/require-execution-role.ts`
   - 実行ID → テストスイート → プロジェクト経由で権限チェック

2. **ExecutionService拡張**
   - `apps/api/src/services/execution.service.ts`
   - `findByIdWithDetails()` - スナップショット、全結果を含む詳細取得

3. **ExecutionRepository拡張**
   - `apps/api/src/repositories/execution.repository.ts`
   - 詳細なinclude設定

#### フロントエンド
4. **StartExecutionModal作成**
   - `apps/web/src/components/execution/StartExecutionModal.tsx`
   - 環境選択（プロジェクト設定から取得）
   - 確認ダイアログ

5. **TestSuiteDetail拡張**
   - `apps/web/src/pages/TestSuiteDetail.tsx`
   - 実行開始ボタンでモーダル表示

6. **API型定義追加**
   - `apps/web/src/lib/api.ts`
   - `ExecutionWithDetails`, `ExecutionSnapshot`, 結果型

---

### Step 2: 手順・期待値記録UI (EX-004, EX-005)

#### フロントエンド
1. **ExecutionTestCaseList**
   - `apps/web/src/components/execution/ExecutionTestCaseList.tsx`
   - テストケースをアコーディオンで表示
   - スナップショットデータを使用

2. **ExecutionTestCaseItem**
   - `apps/web/src/components/execution/ExecutionTestCaseItem.tsx`
   - 個別テストケースの展開表示

3. **ExecutionPreconditionList**
   - `apps/web/src/components/execution/ExecutionPreconditionList.tsx`
   - 前提条件チェック（UNCHECKED/MET/NOT_MET）

4. **ExecutionStepList**
   - `apps/web/src/components/execution/ExecutionStepList.tsx`
   - ステップ実施記録（PENDING/DONE/SKIPPED）

5. **ExecutionExpectedResultList**
   - `apps/web/src/components/execution/ExecutionExpectedResultList.tsx`
   - 期待値判定（PENDING/PASS/FAIL/SKIPPED/NOT_EXECUTABLE）

6. **Execution.tsx大幅拡張**
   - `apps/web/src/pages/Execution.tsx`
   - 上記コンポーネントの組み込み
   - サマリーカードの実データ表示

---

### Step 3: エビデンス機能 (EX-007)

#### バックエンド
1. **multer設定**
   - `apps/api/src/config/upload.ts`
   - ファイルサイズ上限: 100MB
   - 許可MIMEタイプ設定

2. **ExecutionService拡張**
   - `uploadEvidenceFile()` - ファイルアップロード + MinIO保存
   - `deleteEvidence()` - エビデンス削除

3. **ExecutionController拡張**
   - `apps/api/src/controllers/execution.controller.ts`
   - ファイルアップロードハンドラ

4. **ルート追加**
   - `apps/api/src/routes/executions.ts`
   - `POST .../evidences/upload` - ファイルアップロード
   - `DELETE .../evidences/:evidenceId` - 削除

#### フロントエンド
5. **ExecutionEvidenceList**
   - `apps/web/src/components/execution/ExecutionEvidenceList.tsx`
   - エビデンス一覧表示
   - 画像プレビュー、ダウンロードリンク

6. **ExecutionEvidenceUpload**
   - `apps/web/src/components/execution/ExecutionEvidenceUpload.tsx`
   - ドラッグ&ドロップ対応
   - アップロード進捗表示

---

### Step 4: 実行結果一覧 (EX-006)

#### フロントエンド
1. **ExecutionHistoryTab拡張**
   - テストスイート詳細の「実行履歴」タブ拡張
   - フィルタリング（ステータス、日付範囲）
   - ページネーション

---

## 重要ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/services/execution.service.ts` | `findByIdWithDetails()`, エビデンス機能追加 |
| `apps/api/src/middleware/require-execution-role.ts` | 新規作成 |
| `apps/api/src/config/upload.ts` | 新規作成 |
| `apps/api/src/routes/executions.ts` | エビデンスルート追加 |
| `apps/web/src/pages/Execution.tsx` | 大幅拡張 |
| `apps/web/src/components/execution/*.tsx` | 複数コンポーネント新規作成 |
| `apps/web/src/lib/api.ts` | 型定義追加 |

---

## 技術仕様

### ファイルアップロード制限
| 項目 | 制限値 |
|------|--------|
| ファイルサイズ上限 | 100MB |
| 許可ファイルタイプ | image/*, video/*, audio/*, application/pdf, text/plain, text/csv, application/json, application/zip |
| 1期待値あたりの上限 | 10ファイル |

### MinIOストレージ構造
```
agentest/
└── evidences/
    └── {executionId}/
        └── {expectedResultId}/
            └── {uuid}_{originalFilename}
```

### 権限要件
| 操作 | 必要ロール |
|------|-----------|
| 実行詳細閲覧 | READ以上 |
| 実行開始/中止/完了 | WRITE以上 |
| 結果更新 | WRITE以上 |
| エビデンスアップロード/削除 | WRITE以上 |

---

## テスト計画

### 統合テスト
- 実行開始〜完了のフルフロー
- 権限チェック（READ, WRITE, ADMIN）
- エビデンスアップロード（サイズ超過、タイプエラー）
- 完了済み実行の更新拒否
