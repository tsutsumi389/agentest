# エビデンスダウンロードURL修正 & 画像プレビュー表示

## Context

テスト実行画面（`/executions`）のエビデンスダウンロードURLが `http://minio:9000/`（Docker内部ホスト名）になっており、ブラウザからアクセスできない。また、画像エビデンスがアイコン表示のみで、インラインプレビューがない。

## 修正1: ダウンロードURLの内部URL問題

### 原因

`execution.service.ts:423` の `getEvidenceDownloadUrl` で `this.storage`（内部用: `http://minio:9000`）を使用している。`this.publicStorage`（公開用: `http://localhost:9002`）を使うべき。

### 変更

**`apps/api/src/services/execution.service.ts`** (行423)
- `this.storage.getDownloadUrl` → `this.publicStorage.getDownloadUrl`

**`apps/api/src/__tests__/unit/execution.service.evidence.test.ts`**
- `vi.hoisted` に `mockPublicStorageGetDownloadUrl` を追加
- `createPublicStorageClient` モックに `getDownloadUrl: mockPublicStorageGetDownloadUrl` を追加
- `getEvidenceDownloadUrl` テストのアサーションを `mockPublicStorageGetDownloadUrl` に変更

## 修正2: 期待結果に画像プレビュー表示

### 方針

`findByIdWithDetails` APIレスポンスにエビデンスのpresigned download URLを含める。フロントエンドで個別にAPIを叩く必要がなくなる。

> `getSignedUrl` はネットワーク通信不要（ローカル署名計算のみ）なのでパフォーマンス影響なし。

### 変更ファイル

#### 1. `apps/api/src/services/execution.service.ts`

- `findByIdWithDetails` でエビデンスに `downloadUrl` を付与
  - `fileSize > 0`（アップロード完了済み）のエビデンスのみURL生成
  - `this.publicStorage.getDownloadUrl` を使用（1時間有効）
  - `Promise.allSettled` で並列生成、失敗時は `null`

#### 2. `apps/web/src/lib/api.ts` (行767-776)

`ExecutionEvidence` に `downloadUrl: string | null` を追加

#### 3. `apps/web/src/components/execution/ExecutionEvidenceList.tsx`

- 画像エビデンスで `downloadUrl` がある場合、`<img>` タグでサムネイル表示
- `useState` で画像読み込みエラーを管理し、エラー時はアイコンにフォールバック

#### 4. テスト更新

- `apps/api/src/__tests__/unit/execution.service.evidence.test.ts`: モック更新 + `findByIdWithDetails` のdownloadUrl生成テスト追加

## 検証方法

1. `docker compose exec dev pnpm test` でテスト通過を確認
2. `docker compose exec dev pnpm build` でビルド通過を確認
3. ブラウザで `/executions/{id}` を開き、エビデンスのダウンロードが `http://localhost:9002/...` のURLで動作することを確認
4. 画像エビデンスがサムネイル表示されることを確認
