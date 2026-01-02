# upload_execution_evidence MCPツール実装計画

## 概要

テスト実行時にエビデンス（スクリーンショット等）をアップロードするMCPツール `upload_execution_evidence` を実装する。

## 実装方針

**アプローチ**: 内部API新規作成（Base64 JSON形式）

既存のMCPツールパターン（JSON形式の内部API呼び出し）と一致させるため、Base64エンコードされたファイルデータを受け付ける内部APIエンドポイントを新規作成する。

## 実装ファイル一覧

### 1. API側（Base64対応エンドポイント）

**ファイル**: `apps/api/src/routes/internal.ts`

追加するエンドポイント:
```
POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences
```

処理フロー:
1. userIdクエリパラメータ検証
2. リクエストボディ検証（fileName, fileData, fileType, description）
3. 書き込み権限チェック（`authService.canWriteToExecution`）
4. Base64デコード → Buffer
5. MIMEタイプ検証（`isAllowedMimeType`）
6. ファイルサイズ検証（MAX_FILE_SIZE）
7. Express.Multer.File形式に変換
8. 既存の`executionService.uploadEvidence()`を呼び出し
9. レスポンス返却

### 2. MCPツール

**ファイル**: `apps/mcp-server/src/tools/upload-execution-evidence.ts`（新規作成）

```typescript
入力スキーマ:
- executionId: string (UUID) - 実行ID
- expectedResultId: string (UUID) - 期待結果ID
- fileName: string - ファイル名（拡張子含む）
- fileData: string - Base64エンコードされたファイルデータ
- fileType: string - MIMEタイプ（例: image/png）
- description: string (optional) - エビデンスの説明
```

### 3. ツール登録

**ファイル**: `apps/mcp-server/src/tools/index.ts`

- `uploadExecutionEvidenceTool` をインポート
- `toolRegistry.register()` に追加

## 制限事項

| 項目 | 値 |
|------|-----|
| 1期待結果あたりの上限 | 10件 |
| ファイルサイズ上限 | 100MB（既存のMAX_FILE_SIZEを流用） |
| 許可MIMEタイプ | 画像、動画、音声、ドキュメント |
| 対象実行状態 | IN_PROGRESSのみ |

### express.json制限の変更

`apps/api/src/app.ts` の設定を変更:
```typescript
// 変更前
app.use(express.json({ limit: '10mb' }));

// 変更後
app.use(express.json({ limit: '50mb' }));
```

Base64エンコード後を考慮すると、express.jsonの50MB制限により実質約37MBまでのファイルをアップロード可能。
（デコード後のMAX_FILE_SIZE=100MBチェックよりexpress.json制限が先に適用される）

## テストコード

### ユニットテスト
- `apps/mcp-server/src/__tests__/unit/tools/upload-execution-evidence.test.ts`（新規作成）

### 結合テスト
- `apps/api/src/__tests__/integration/internal-api-evidence.integration.test.ts`（新規作成）

## 実装順序

1. `apps/api/src/app.ts` のexpress.json制限を50MBに変更
2. `apps/api/src/routes/internal.ts` にBase64対応エンドポイント追加
3. `apps/mcp-server/src/tools/upload-execution-evidence.ts` 新規作成
4. `apps/mcp-server/src/tools/index.ts` にツール登録
5. ユニットテスト作成
6. 結合テスト作成
7. 動作確認

## 依存関係

既存で利用可能:
- `ExecutionService.uploadEvidence()` - MinIOアップロード処理
- `InternalAuthorizationService.canWriteToExecution()` - 権限チェック
- `isAllowedMimeType()`, `MAX_FILE_SIZE` - バリデーション関数・定数
