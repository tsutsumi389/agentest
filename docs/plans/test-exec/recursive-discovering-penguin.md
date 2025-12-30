# EX-007 エビデンス機能 実装計画

## 概要

テスト実行の期待結果に対して、スクリーンショット・動画等のエビデンスファイルをアップロード・管理する機能を実装する。

## 現状

| 項目 | 状態 |
|------|------|
| ExecutionService.uploadEvidence() | メタデータ保存のみ実装 |
| 実ファイルのMinIO保存 | **未実装** |
| multer設定 | **未実装** |
| deleteEvidence() | **未実装** |
| フロントエンドエビデンスUI | **未実装** |
| StorageClient (@agentest/storage) | 実装済み |

## 技術仕様

- **ファイルサイズ上限**: 100MB
- **許可ファイルタイプ**: image/*, video/*, audio/*, application/pdf, text/plain, text/csv, application/json, application/zip
- **1期待値あたりの上限**: 10ファイル
- **MinIOパス**: `evidences/{executionId}/{expectedResultId}/{uuid}_{originalFilename}`
- **権限**: WRITE以上、完了した実行へのアップロード不可

---

## 実装ステップ

### Step 1: multer設定

**新規ファイル**: `apps/api/src/config/upload.ts`

```typescript
// 内容:
// - ALLOWED_MIME_TYPES 定義
// - MAX_FILE_SIZE = 100 * 1024 * 1024
// - MAX_EVIDENCES_PER_RESULT = 10
// - evidenceUpload = multer({ memoryStorage, limits, fileFilter })
```

**依存関係追加**: `apps/api/package.json` に `multer`, `@types/multer`

---

### Step 2: ExecutionService拡張

**ファイル**: `apps/api/src/services/execution.service.ts`

1. **インポート追加**
   - `createStorageClient` from `@agentest/storage`
   - `uuid` (v4)
   - `MAX_EVIDENCES_PER_RESULT` from config

2. **uploadEvidence() 修正** (行167-203)
   - 入力を `Express.Multer.File` に変更
   - 完了済み実行チェック追加
   - エビデンス上限チェック追加
   - MinIOへのアップロード処理追加
   - `fileUrl` にはMinIOキーを保存

3. **deleteEvidence() 新規追加**
   - 実行・エビデンス存在確認
   - 完了済み実行チェック
   - MinIOからファイル削除
   - DBレコード削除

4. **getEvidenceDownloadUrl() 新規追加**
   - 署名付きダウンロードURL生成（1時間有効）

---

### Step 3: ExecutionController拡張

**ファイル**: `apps/api/src/controllers/execution.controller.ts`

1. **uploadEvidence修正**
   - `req.file` からファイル取得
   - ファイル未指定エラーチェック

2. **deleteEvidence新規追加**
   - `DELETE /:executionId/evidences/:evidenceId` ハンドラ

3. **getEvidenceDownloadUrl新規追加**
   - `GET /:executionId/evidences/:evidenceId/download-url` ハンドラ

4. **静的メソッド追加**
   - `evidenceUploadMiddleware` = evidenceUpload.single('file')

---

### Step 4: ルート追加

**ファイル**: `apps/api/src/routes/executions.ts`

1. **既存エンドポイント修正** (行99-104)
   - multerミドルウェア追加

2. **新規エンドポイント追加**
   ```
   DELETE /:executionId/evidences/:evidenceId
   GET /:executionId/evidences/:evidenceId/download-url
   ```

---

### Step 5: フロントエンドAPI追加

**ファイル**: `apps/web/src/lib/api.ts`

`executionsApi` に追加:
- `uploadEvidence(executionId, expectedResultId, file, description?)` - FormData対応
- `deleteEvidence(executionId, evidenceId)`
- `getEvidenceDownloadUrl(executionId, evidenceId)`

---

### Step 6: ExecutionEvidenceListコンポーネント

**新規ファイル**: `apps/web/src/components/execution/ExecutionEvidenceList.tsx`

- エビデンス一覧表示
- ファイルタイプ別アイコン表示
- 画像はサムネイルプレビュー
- ダウンロードボタン
- 削除ボタン（編集可能時のみ）
- ファイルサイズ表示

---

### Step 7: ExecutionEvidenceUploadコンポーネント

**新規ファイル**: `apps/web/src/components/execution/ExecutionEvidenceUpload.tsx`

- ドラッグ&ドロップエリア
- ファイル選択ボタン
- 説明入力フィールド（オプション）
- アップロード進捗表示
- クライアント側バリデーション（サイズ、タイプ）
- エラー表示
- 上限到達警告

---

### Step 8: 既存コンポーネント統合

**ファイル**: `apps/web/src/components/execution/ExecutionExpectedResultList.tsx`

- エビデンス関連のProps追加
- 各期待結果アイテムにエビデンスUI組み込み

**ファイル**: `apps/web/src/pages/Execution.tsx`

- エビデンスアップロードmutation追加
- エビデンス削除mutation追加
- ダウンロードハンドラ追加
- 状態管理（deletingEvidenceId等）

---

### Step 9: ユニットテスト

**新規ファイル**: `apps/api/src/__tests__/unit/execution.service.evidence.test.ts`

テストケース:
- uploadEvidence: MinIOアップロード、完了済み拒否、上限チェック
- deleteEvidence: MinIO削除、完了済み拒否、存在確認
- getEvidenceDownloadUrl: URL生成、存在確認

---

### Step 10: 統合テスト

**新規ファイル**: `apps/api/src/__tests__/integration/execution-evidence.integration.test.ts`

テストケース:
- POST /evidences: アップロード成功、権限チェック、バリデーション
- DELETE /evidences/:id: 削除成功、権限チェック
- GET /evidences/:id/download-url: URL取得成功、権限チェック

---

## 重要ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/config/upload.ts` | **新規** - multer設定 |
| `apps/api/src/services/execution.service.ts` | uploadEvidence修正、deleteEvidence/getDownloadUrl追加 |
| `apps/api/src/controllers/execution.controller.ts` | ハンドラ追加 |
| `apps/api/src/routes/executions.ts` | multerミドルウェア、DELETEルート追加 |
| `apps/web/src/lib/api.ts` | FormData対応アップロードAPI追加 |
| `apps/web/src/components/execution/ExecutionEvidenceList.tsx` | **新規** |
| `apps/web/src/components/execution/ExecutionEvidenceUpload.tsx` | **新規** |
| `apps/web/src/components/execution/ExecutionExpectedResultList.tsx` | エビデンスUI統合 |
| `apps/web/src/pages/Execution.tsx` | mutation/ハンドラ追加 |

---

## エラーハンドリング

| エラーケース | HTTPステータス | メッセージ |
|-------------|---------------|-----------|
| ファイル未指定 | 400 | ファイルが指定されていません |
| MIMEタイプ不正 | 400 | 許可されていないファイル形式です |
| ファイルサイズ超過 | 400 | ファイルサイズが上限を超えています |
| 上限到達 | 400 | エビデンスの上限（10件）に達しています |
| 完了済み実行 | 409 | 完了済みの実行にはエビデンスをアップロードできません |
| 実行/エビデンス未発見 | 404 | Not found |
