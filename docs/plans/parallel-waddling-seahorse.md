# upload_execution_evidence MCPツールの改善: filePath パラメータに置き換え

## Context

現在の `upload_execution_evidence` MCPツールは、ファイルデータをBase64エンコード文字列として受け取る。これにより：
- Claude Code がBase64文字列をツール引数に含むため**コンテキストウィンドウを大量消費**
- Base64で**33%のネットワークオーバーヘッド**
- MCPサーバー→Internal API間もBase64 JSONで通信

改善: `fileData`（Base64）を廃止し、`filePath` パラメータに置き換え。MCPサーバーがローカルファイルを直接読み取り、multipart/form-data で Internal API に送信する。

**Before:**
```
Claude Code → (Base64文字列をツール引数に) → MCP Server → (Base64 JSON) → Internal API → decode → MinIO
```

**After:**
```
Claude Code → (filePathだけ) → MCP Server → fs.readFile() → (multipart/form-data) → Internal API → multer → MinIO
```

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/mcp-server/package.json` | `mime-types` 依存追加 |
| `apps/mcp-server/src/tools/upload-execution-evidence.ts` | `fileData` → `filePath` に置換、ファイル読み取り、multipart送信 |
| `apps/mcp-server/src/clients/api-client.ts` | `postMultipart()` メソッド追加 |
| `apps/api/src/routes/internal.ts` | Base64 JSON → multer multipart に変更 |
| `apps/mcp-server/src/__tests__/unit/tools/upload-execution-evidence.test.ts` | テスト更新・追加 |
| `apps/api/src/__tests__/integration/internal-api-evidence.integration.test.ts` | multipart形式にテスト変更 |

## 実装手順

### Step 1: `mime-types` 依存追加

`apps/mcp-server/package.json` に `mime-types` を追加（拡張子からMIMEタイプを自動検出するため）。

### Step 2: MCP API Client に `postMultipart()` 追加

`apps/mcp-server/src/clients/api-client.ts` に以下を追加：

```typescript
interface FileUpload {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

async postMultipart<T>(
  path: string,
  data: { file: FileUpload; fields?: Record<string, string> },
  params?: Record<string, string>
): Promise<T>
```

- Node.js 18+ 組み込みの `FormData` / `Blob` を使用（外部ライブラリ不要）
- `Content-Type` ヘッダーは `fetch` が自動設定（multipart boundary含む）
- `X-Internal-API-Key` ヘッダーは既存と同様に付与

### Step 3: MCPツールの入力スキーマ・ハンドラー変更

`apps/mcp-server/src/tools/upload-execution-evidence.ts`:

**スキーマ変更:**
- `fileData` を削除
- `filePath` を追加（必須、ローカルファイルパス）
- `fileName`: optional に変更（省略時はパスから自動検出）
- `fileType`: optional に変更（省略時は拡張子から自動検出）

**ハンドラー変更:**
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';

// ファイル読み取り
const fileBuffer = await fs.readFile(input.filePath);
const fileName = input.fileName || path.basename(input.filePath);
const fileType = input.fileType || mime.lookup(input.filePath) || 'application/octet-stream';

// multipart/form-data で Internal API に送信
await apiClient.postMultipart(path, { file: { buffer, fileName, mimeType }, fields }, { userId });
```

**ツール description 更新:**
- `filePath` を使ったアップロード方法を記載

### Step 4: Internal API エンドポイントを multipart 対応に変更

`apps/api/src/routes/internal.ts` (行1219-1334):

- `evidenceUpload.single('file')` multer ミドルウェアを追加（`apps/api/src/config/upload.ts` から import）
- `req.file` からファイルデータを取得
- `req.body.description` からオプショナルな説明を取得
- **削除するもの**: `uploadEvidenceBodySchema`, Base64正規表現検証, `Buffer.from(fileData, 'base64')`, 手動MIMEタイプチェック, 手動ファイルサイズチェック, 手動 `Express.Multer.File` オブジェクト構築
- 認可チェック (`authService.canWriteToExecution`) とレスポンス形式は維持

### Step 5: テスト更新

**MCPツール ユニットテスト** (`apps/mcp-server/src/__tests__/unit/tools/upload-execution-evidence.test.ts`):
- `apiClient.post` → `apiClient.postMultipart` のモック変更
- `fileData` 関連テストを `filePath` に書き換え
- 追加テスト:
  - filePath指定時のファイル読み取り・fileName/fileType自動検出
  - filePath + fileName/fileType 明示上書き
  - 存在しないfilePathのエラー

**Internal API 統合テスト** (`apps/api/src/__tests__/integration/internal-api-evidence.integration.test.ts`):
- `.send({ fileData: base64 })` → `.attach('file', buffer, { filename, contentType })` に変更
- description付きテスト: `.field('description', '...')` 追加
- Base64固有テスト（不正Base64）の削除
- ファイル未添付テストの追加

**ExecutionService ユニットテスト**: 変更不要（`Express.Multer.File` インターフェースは変わらない）

## 検証方法

1. `docker compose exec dev pnpm build` — ビルド成功確認
2. `docker compose exec dev pnpm test` — 全テスト通過確認
3. MCPツールの手動テスト:
   - `filePath` でスクリーンショットをアップロード
   - 存在しないファイルパスでエラー確認
