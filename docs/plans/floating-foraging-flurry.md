# M-1: ファイルアップロードのマジックバイト検証

## Context

現在、ファイルアップロード時の種別判定はHTTPの`Content-Type`ヘッダー（Multerの`file.mimetype`）のみに依存している。MIMEタイプは容易に偽装可能なため、実際のファイル内容（マジックバイト）を検証し、悪意あるファイルの偽装アップロードを防止する。

また、`isAllowedMimeType()`が`image/*`、`video/*`、`audio/*`のワイルドカードを許可しており、意図しないサブタイプが通過する問題も合わせて修正する。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/package.json` | `file-type` パッケージ追加 |
| `apps/api/src/config/upload.ts` | `validateMagicBytes()` 関数追加、ワイルドカード削除 |
| `apps/api/src/services/execution.service.ts` | `uploadEvidence()` でマジックバイト検証を呼び出し |
| `apps/api/src/__tests__/unit/upload.config.test.ts` | テスト更新・追加 |

## 実装手順

### Step 1: `file-type` パッケージを追加

`apps/api/package.json` に `file-type` を追加する（ESM対応済み、`"type": "module"`）。

### Step 2: `upload.ts` を修正

#### 2a. ワイルドカードMIMEタイプの削除

`isAllowedMimeType()` から `image/*`、`video/*`、`audio/*` のワイルドカード分岐を削除し、`ALLOWED_MIME_TYPES` ホワイトリストの完全一致のみに制限する。

#### 2b. テキスト系MIMEタイプのセットを定義

マジックバイト検証をスキップするテキスト系タイプを定義:
```typescript
const TEXT_BASED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'image/svg+xml',
]);
```

#### 2c. MIMEタイプ等価マッピングを定義

`file-type` が返すMIMEとホワイトリストのMIMEが微妙に異なるケースに対応:
```typescript
const MIME_EQUIVALENCES: Record<string, string> = {
  'audio/x-wav': 'audio/wav',
  'video/vnd.avi': 'video/x-msvideo',
};
```

#### 2d. `validateMagicBytes()` 関数を追加

```typescript
export async function validateMagicBytes(
  buffer: Buffer,
  declaredMimeType: string
): Promise<void>
```

ロジック:
1. テキスト系MIMEタイプの場合 → スキップ（マジックバイトなし）
2. `fileTypeFromBuffer(buffer)` でマジックバイトから実際のMIMEタイプを検出
3. 検出できない場合 → エラー（バイナリファイルなのにマジックバイトがない）
4. 検出結果のMIMEタイプを等価マッピングで正規化
5. 正規化後のMIMEが宣言されたMIMEと一致しない場合 → エラー

### Step 3: `execution.service.ts` で呼び出し

`uploadEvidence()` メソッド内、MinIOアップロードの直前で `validateMagicBytes(file.buffer, file.mimetype)` を呼び出す。両方のアップロードパス（Multer経由・Internal API経由）がこのメソッドを通るため、一箇所の修正で両方をカバーできる。

### Step 4: テストを更新

#### `upload.config.test.ts` の修正:
- ワイルドカードで `true` を返していたテストを `false` に変更
- `validateMagicBytes()` のテストを追加:
  - 正当なPNG/JPEG/PDF: パス
  - テキスト系ファイル: スキップされてパス
  - MIMEタイプ偽装（PNG宣言だが中身はJPEG）: エラー
  - 不明なバイナリ: エラー

## 検証方法

```bash
# ユニットテスト
docker compose exec dev pnpm --filter @agentest/api test

# ビルド確認
docker compose exec dev pnpm --filter @agentest/api build
```
