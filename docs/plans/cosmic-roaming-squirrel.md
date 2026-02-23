# Presigned URLパターンによるエビデンスアップロード

## Context

MCPサーバーはDockerコンテナ（HTTP接続 `http://localhost:3004/mcp`）で動作する。エージェント（ホストマシン）が `agent-browser screenshot /tmp/screenshot.png` で保存したファイルに、コンテナ内の `fs.readFile()` からアクセスできない（ENOENT）。本番環境ではMCPサーバーはWebサーバー上にあるためボリュームマウントでは対応不可。Base64（fileData）はLLMトークンを浪費するため不可。

**解決策**: presigned PUT URLを生成し、エージェントが `curl` でMinIO/S3に直接アップロードする。

## フロー

```
エージェント(ホスト)           MCPサーバー(コンテナ)        API(コンテナ)            MinIO/S3
     |                              |                        |                      |
     |-- upload_execution_evidence ->|                        |                      |
     |   (filePath, description)     |-- POST /upload-url --->|                      |
     |                              |                        |-- getUploadUrl() ---->|
     |                              |                        |<-- presigned URL -----|
     |                              |                        |-- DB INSERT --------->|
     |                              |<-- { uploadUrl } ------|                      |
     |<-- { uploadUrl, filePath,    |                        |                      |
     |      contentType } ----------|                        |                      |
     |                              |                        |                      |
     |-- curl -X PUT (エージェントが構築) ----------------------> 直接PUT            |
     |                              |                        |                      |
     |-- confirm_evidence_upload -->|-- POST /confirm ------>|                      |
     |                              |                        |-- HeadObject -------->|
     |                              |                        |<-- metadata ----------|
     |                              |                        |-- DB UPDATE --------->|
```

## セキュリティ対策

本実装では以下のセキュリティ対策を適用する:

| 脅威 | 対策 |
|------|------|
| コマンドインジェクション | `curlCommand` を返さず、構造化データ（`uploadUrl`, `filePath`, `contentType`）を返す。エージェント側で安全にcurlを構築 |
| S3キーインジェクション | `sanitizeFileName()` でパス区切り文字・制御文字・危険な文字を除去 |
| Stored XSS (SVG) | `image/svg+xml` を許可MIMEタイプから除外 |
| orphanレコードDoS | presigned URL生成から10分以上経過したPENDINGレコードをカウントから除外 |
| データ整合性 (fileSize: 0) | アップロード確認エンドポイント(`confirm`)でS3メタデータからファイルサイズを取得・更新 |
| SSRF (MINIO_PUBLIC_ENDPOINT) | URLバリデーション（http/httpsプロトコルのみ許可） |
| Presigned URL漏洩 | 有効期限を300秒（5分）に短縮。ログにURLを記録しない |

## 変更一覧

### 1. Storage: `createPublicStorageClient` 追加

**ファイル**: `packages/storage/src/client.ts`, `packages/storage/src/index.ts`

MinIOのpresigned URLの署名にはエンドポイントのホスト名が含まれる。コンテナ内では `http://minio:9000` だが、ホストからは `http://localhost:9002`。署名のホスト名が異なると無効になるため、公開エンドポイント用の別インスタンスが必要。

```typescript
// packages/storage/src/client.ts
export function createPublicStorageClient(env: NodeJS.ProcessEnv = process.env): StorageClient {
  const publicEndpoint = env.MINIO_PUBLIC_ENDPOINT;
  if (!publicEndpoint) {
    return createStorageClient(env);  // フォールバック（本番S3等）
  }

  // URLバリデーション（SSRF対策）
  try {
    const url = new URL(publicEndpoint);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('MINIO_PUBLIC_ENDPOINT must use http or https protocol');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`MINIO_PUBLIC_ENDPOINT is not a valid URL: ${publicEndpoint}`);
    }
    throw error;
  }

  return new StorageClient({
    endpoint: publicEndpoint,
    accessKeyId: getRequiredEnvVar(env, 'MINIO_ACCESS_KEY', 'MINIO_ROOT_USER', 'agentest'),
    secretAccessKey: getRequiredEnvVar(env, 'MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD', 'agentest123'),
    bucket: getRequiredEnvVar(env, 'MINIO_BUCKET', undefined, 'agentest'),
  });
}
```

`packages/storage/src/index.ts` に export 追加。

### 2. 環境変数: `MINIO_PUBLIC_ENDPOINT` 追加

| ファイル | 変更 |
|---------|------|
| `.env.example` | MinIOセクションに `MINIO_PUBLIC_ENDPOINT=http://localhost:9002` 追加 |
| `docker/docker-compose.override.yml` | apiサービスの environment に `MINIO_PUBLIC_ENDPOINT: http://host.docker.internal:${MINIO_API_EXTERNAL_PORT:-9002}` 追加 |

**注意**: `docker-compose.yml`（本番用）には追加しない。本番ではS3のエンドポイントが外部からも内部からも同一のため不要（`MINIO_PUBLIC_ENDPOINT` 未設定時は通常のクライアントにフォールバック）。

### 3. API: ファイルアップロード設定の強化

**ファイル**: `apps/api/src/config/upload.ts`

#### 3-1. SVGを許可MIMEタイプから除外

SVGにはJavaScriptを埋め込むことができ、ブラウザで表示された際にStored XSSが成立するため除外する。

```typescript
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // 'image/svg+xml',  // 除外: XSSリスク
  'image/bmp',
  // ...（他は変更なし）
];

// TEXT_BASED_MIME_TYPES からも image/svg+xml を除外
export const TEXT_BASED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
]);
```

#### 3-2. `sanitizeFileName()` 関数追加

S3キーインジェクション対策として、ファイル名からパス区切り文字・制御文字・危険な文字を除去する。

```typescript
/**
 * ファイル名をサニタイズ（S3キーインジェクション対策）
 *
 * パス区切り文字、制御文字、危険な文字を除去し、安全なファイル名を返す。
 */
export function sanitizeFileName(fileName: string): string {
  // パス区切り文字を除去
  let sanitized = fileName.replace(/[/\\]/g, '_');
  // 制御文字・シェルメタ文字を除去（英数字、ハイフン、アンダースコア、ドット、スペースのみ許可）
  sanitized = sanitized.replace(/[^\w.\- ]/g, '_');
  // 連続するアンダースコアを1つに
  sanitized = sanitized.replace(/_+/g, '_');
  // 先頭・末尾のアンダースコア/スペースを除去
  sanitized = sanitized.replace(/^[_ ]+|[_ ]+$/g, '');
  // ダブルドット対策
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'unnamed_file';
  }
  // 長さ制限（200文字）
  return sanitized.slice(0, 200);
}
```

### 4. API: presigned URLエンドポイント追加

#### 4-1. ExecutionService にメソッド追加

**ファイル**: `apps/api/src/services/execution.service.ts`

```typescript
private _publicStorage: StorageClient | null = null;
private get publicStorage(): StorageClient {
  if (!this._publicStorage) {
    this._publicStorage = createPublicStorageClient();
  }
  return this._publicStorage;
}

async createEvidenceUploadUrl(
  executionId: string,
  expectedResultId: string,
  userId: string,
  params: { fileName: string; fileType: string; description?: string }
): Promise<{ evidenceId: string; uploadUrl: string }>
```

処理:
1. `findById(executionId)` - 存在確認
2. `executionExpectedResult.findFirst` - 期待結果の存在確認 + evidences include
3. **orphan対策付きカウントチェック**: 10分以上前のPENDING（fileSize: 0）レコードをカウントから除外
4. `isAllowedMimeType(fileType)` チェック
5. **ファイル名サニタイズ**: `sanitizeFileName(fileName)` を適用してS3キーを安全に生成
6. S3キー生成: `evidences/{executionId}/{expectedResultId}/{UUID}_{sanitizedFileName}`
7. `publicStorage.getUploadUrl(fileKey, { expiresIn: 300, contentType: fileType })` - presigned URL生成（**5分**）
8. `executionEvidence.create(...)` - DBレコード作成（fileSize: 0）
9. `{ evidenceId, uploadUrl }` を返却

```typescript
// orphan対策: 10分以上前のfileSize: 0レコードをカウントから除外
const PENDING_EVIDENCE_EXPIRY_MS = 10 * 60 * 1000;
const pendingCutoff = new Date(Date.now() - PENDING_EVIDENCE_EXPIRY_MS);

const activeEvidenceCount = expectedResult.evidences.filter(
  (e) => e.fileSize > 0n || e.createdAt > pendingCutoff
).length;

if (activeEvidenceCount >= MAX_EVIDENCES_PER_RESULT) {
  throw new BadRequestError(`エビデンスの上限（${MAX_EVIDENCES_PER_RESULT}件）に達しています`);
}
```

#### 4-2. ExecutionService にアップロード確認メソッド追加

```typescript
async confirmEvidenceUpload(
  executionId: string,
  evidenceId: string,
  userId: string
): Promise<{ fileSize: number }>
```

処理:
1. `findById(executionId)` - 存在確認
2. `executionEvidence.findFirst` - エビデンスの存在確認
3. `storage.getMetadata(evidence.fileUrl)` - S3のファイルメタデータを取得
4. メタデータが存在しない場合はエラー（アップロード未完了）
5. `executionEvidence.update` - fileSizeを更新
6. `{ fileSize }` を返却

#### 4-3. Internal APIルート追加

**ファイル**: `apps/api/src/routes/internal.ts`

**エンドポイント1: presigned URL生成**

```
POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences/upload-url
```

- 認証: `requireInternalApiAuth()` （既存ミドルウェア）
- 認可: `authService.canWriteToExecution(userId, executionId)`
- ボディ: `{ fileName: string, fileType: string, description?: string }` (Zod)
- レスポンス: `201 { evidenceId, uploadUrl }`

**エンドポイント2: アップロード確認**

```
POST /internal/api/executions/:executionId/evidences/:evidenceId/confirm
```

- 認証: `requireInternalApiAuth()`
- 認可: `authService.canWriteToExecution(userId, executionId)`
- ボディ: なし
- レスポンス: `200 { evidenceId, fileSize }`

既存のmultipart/form-dataエンドポイントはそのまま維持（Web UIからの直接アップロード用）。

### 5. MCPツール変更

**ファイル**: `apps/mcp-server/src/tools/upload-execution-evidence.ts`

**入力スキーマ**: `filePath` は維持（ファイル名/MIMEタイプ自動推測用。ファイルアクセスはしない）

**ハンドラー変更**:
- `fs.stat()` / `fs.readFile()` を**完全に削除**（コンテナ内からホストのファイルにアクセスできないため）
- `nodePath.basename(filePath)` でファイル名推測（ファイルアクセス不要）
- `mime.lookup(filePath)` でMIMEタイプ推測（拡張子ベース、ファイルアクセス不要）
- `apiClient.postMultipart()` → `apiClient.post()` に変更（JSON形式）
- APIエンドポイント: `/internal/api/.../evidences/upload-url`

**レスポンス型**（構造化データ、curlCommand廃止）:
```typescript
{
  evidenceId: string;
  uploadUrl: string;      // presigned PUT URL
  filePath: string;       // エージェントが指定したローカルファイルパス
  contentType: string;    // MIMEタイプ
  confirmEndpoint: string; // アップロード確認用の情報
  message: string;        // エージェントへの指示テキスト
}
```

> **セキュリティ: curlCommand廃止の理由**
>
> `filePath` にシェルメタ文字（`; && | $()` 等）を含む値が渡された場合、コマンドインジェクションが成立する。
> 構造化データのみを返し、エージェント側でcurlコマンドを安全に構築させることで、このリスクを排除する。

**ツール説明文更新**: 3ステップフロー（このツール → curl実行 → confirm）を記載。

### 6. エージェント定義更新

**ファイル**: `.claude/agents/agentest-e2e-runner.md`

「4e. エビデンスのアップロード」セクションを更新:

```markdown
# スクリーンショットを撮影
agent-browser screenshot /tmp/evidence_{tc}_{er}.png

# Step 1: presigned URL取得（構造化データが返される）
upload_execution_evidence(executionId, expectedResultId, filePath, description)
# → { evidenceId, uploadUrl, filePath, contentType, message } が返る

# Step 2: レスポンスの uploadUrl, filePath, contentType を使ってcurlを構築・実行
curl -X PUT -H 'Content-Type: {contentType}' --upload-file '{filePath}' '{uploadUrl}'

# Step 3: アップロード確認（ファイルサイズ更新）
confirm_evidence_upload(executionId, evidenceId)
```

### 7. テスト

| ファイル | 変更 |
|---------|------|
| `apps/api/src/__tests__/unit/execution.service.evidence.test.ts` | `createEvidenceUploadUrl` テスト追加（正常系 + エラー系6パターン + orphanカウント除外テスト） |
| `apps/api/src/__tests__/unit/upload.test.ts` | `sanitizeFileName` テスト追加（パス区切り、制御文字、ダブルドット、空文字、長い名前） |
| `apps/api/src/__tests__/integration/execution-evidence.integration.test.ts` | presigned URL + confirmエンドポイントの統合テスト追加 |
| `apps/mcp-server/src/__tests__/unit/tools/upload-execution-evidence.test.ts` | presigned URL方式に書き換え（`fs.readFile` → 削除、`postMultipart` → `post`、curlCommand → 構造化データ） |

既存テストは変更なし（`uploadEvidence` メソッドは維持）。

### 8. マイグレーション

**不要**。DBスキーマ変更なし。

## 実装順序

1. `apps/api/src/config/upload.ts` - SVG除外 + `sanitizeFileName()` 追加
2. `packages/storage` - `createPublicStorageClient` 追加（URLバリデーション付き）
3. `.env.example` / `docker-compose.override.yml` - 環境変数追加
4. `apps/api/src/services/execution.service.ts` - `createEvidenceUploadUrl` + `confirmEvidenceUpload` メソッド追加
5. `apps/api/src/routes/internal.ts` - エンドポイント追加
6. `apps/mcp-server/src/tools/upload-execution-evidence.ts` - presigned URL方式に変更（構造化データ）
7. `.claude/agents/agentest-e2e-runner.md` - エージェント定義更新
8. テスト更新・追加

## 検証方法

1. `docker compose exec dev pnpm build` - ビルド通過確認
2. `docker compose exec dev pnpm test` - 全テスト通過確認
3. `docker compose restart api` - APIサーバー再起動（環境変数反映）
4. MCPツール `upload_execution_evidence` を呼び出し → 構造化データ（`uploadUrl`, `filePath`, `contentType`）が返却されることを確認
5. レスポンスの値を使って `curl -X PUT -H 'Content-Type: ...' --upload-file '...' '...'` を構築・実行 → HTTP 200 が返りMinIOにファイルが保存されることを確認
6. `confirm_evidence_upload` を呼び出し → fileSizeが更新されることを確認
7. agentestのWeb UIでエビデンスが表示されることを確認
