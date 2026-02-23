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
     |<-- { curlCommand } ----------|                        |                      |
     |                              |                        |                      |
     |-- curl -X PUT --upload-file /tmp/screenshot.png -----------> 直接PUT         |
```

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

### 3. API: presigned URLエンドポイント追加

#### 3-1. ExecutionService にメソッド追加

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
3. `MAX_EVIDENCES_PER_RESULT`（10件）チェック
4. `isAllowedMimeType(fileType)` チェック
5. S3キー生成: `evidences/{executionId}/{expectedResultId}/{UUID}_{fileName}`
6. `publicStorage.getUploadUrl(fileKey, { expiresIn: 600, contentType: fileType })` - presigned URL生成
7. `executionEvidence.create(...)` - DBレコード作成（fileSize: 0）
8. `{ evidenceId, uploadUrl }` を返却

**設計判断**:
- **マジックバイト検証**: 省略（ファイルデータがAPIを経由しないため不可能。MIMEタイプのホワイトリストチェックで代替）
- **ファイルサイズ**: DB には 0 で登録。MCPサーバーからホストのファイルにアクセスできないためサイズ取得不可。S3のデフォルト制限（5GB）に委ねる
- **orphanレコード**: curlが実行されなかった場合、S3に実体がないDBレコードが残る可能性あり。実運用上は稀。将来バックグラウンドクリーンアップで対応可能

#### 3-2. Internal APIルート追加

**ファイル**: `apps/api/src/routes/internal.ts`

```
POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences/upload-url
```

- 認証: `requireInternalApiAuth()` （既存ミドルウェア）
- 認可: `authService.canWriteToExecution(userId, executionId)`
- ボディ: `{ fileName: string, fileType: string, description?: string }` (Zod)
- レスポンス: `201 { evidenceId, uploadUrl }`

既存のmultipart/form-dataエンドポイントはそのまま維持（Web UIからの直接アップロード用）。

### 4. MCPツール変更

**ファイル**: `apps/mcp-server/src/tools/upload-execution-evidence.ts`

**入力スキーマ**: `filePath` は維持（curlCommand生成 + ファイル名/MIMEタイプ自動推測用。ファイルアクセスはしない）

**ハンドラー変更**:
- `fs.stat()` / `fs.readFile()` を**完全に削除**（コンテナ内からホストのファイルにアクセスできないため）
- `nodePath.basename(filePath)` でファイル名推測（ファイルアクセス不要）
- `mime.lookup(filePath)` でMIMEタイプ推測（拡張子ベース、ファイルアクセス不要）
- `apiClient.postMultipart()` → `apiClient.post()` に変更（JSON形式）
- APIエンドポイント: `/internal/api/.../evidences/upload-url`
- レスポンスに `uploadUrl`, `curlCommand`, `message` を含める

**レスポンス型**:
```typescript
{
  evidenceId: string;
  uploadUrl: string;
  curlCommand: string;  // curl -X PUT -H 'Content-Type: ...' --upload-file '...' '...'
  message: string;      // エージェントへの指示テキスト
}
```

**ツール説明文更新**: 2ステップフロー（このツール → curlCommand実行）を記載。

### 5. エージェント定義更新

**ファイル**: `.claude/agents/agentest-e2e-runner.md`

「4e. エビデンスのアップロード」セクションを更新:

```markdown
# スクリーンショットを撮影
agent-browser screenshot /tmp/evidence_{tc}_{er}.png

# Step 1: presigned URL取得
upload_execution_evidence(executionId, expectedResultId, filePath, description)

# Step 2: レスポンスの curlCommand をBashで実行してS3に直接アップロード
```

### 6. テスト

| ファイル | 変更 |
|---------|------|
| `apps/api/src/__tests__/unit/execution.service.evidence.test.ts` | `createEvidenceUploadUrl` テスト追加（正常系 + エラー系6パターン） |
| `apps/api/src/__tests__/integration/execution-evidence.integration.test.ts` | presigned URLエンドポイントの統合テスト追加 |
| `apps/mcp-server/src/__tests__/unit/tools/upload-execution-evidence.test.ts` | presigned URL方式に書き換え（`fs.readFile` → 削除、`postMultipart` → `post`） |

既存テストは変更なし（`uploadEvidence` メソッドは維持）。

### 7. マイグレーション

**不要**。DBスキーマ変更なし。

## 実装順序

1. `packages/storage` - `createPublicStorageClient` 追加
2. `.env.example` / `docker-compose.override.yml` - 環境変数追加
3. `apps/api/src/services/execution.service.ts` - `createEvidenceUploadUrl` メソッド追加
4. `apps/api/src/routes/internal.ts` - エンドポイント追加
5. `apps/mcp-server/src/tools/upload-execution-evidence.ts` - presigned URL方式に変更
6. `.claude/agents/agentest-e2e-runner.md` - エージェント定義更新
7. テスト更新・追加

## 検証方法

1. `docker compose exec dev pnpm build` - ビルド通過確認
2. `docker compose exec dev pnpm test` - 全テスト通過確認
3. `docker compose restart api` - APIサーバー再起動（環境変数反映）
4. MCPツール `upload_execution_evidence` を呼び出し → `curlCommand` が返却されることを確認
5. 返却された `curlCommand` を実行 → HTTP 200 が返りMinIOにファイルが保存されることを確認
6. agentestのWeb UIでエビデンスが表示されることを確認
