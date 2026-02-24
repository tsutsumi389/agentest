# テスト実行画面 エビデンス表示の改善

## Context

テスト実行(`/executions`)画面の期待結果セクションで、エビデンス（添付ファイル）の表示・操作性に以下の問題がある：

1. ダウンロードアイコンクリックで別ウィンドウに画像が開くだけで、実際にダウンロードされない
2. 画像のサムネイルが小さすぎる（w-8 h-8 = 32x32px）
3. 画像クリックで拡大プレビューできない
4. ファイルアップロード領域が常に表示されるため、過去の結果閲覧時に邪魔

## 変更内容

### 1. 画像プレビューモーダルの新規作成

**新規ファイル:** `apps/web/src/components/common/ImagePreviewModal.tsx`

- `ConfirmDialog.tsx` のモーダルパターンを踏襲（`fixed inset-0 z-modal`、ESC閉じ、背景スクロール無効化）
- props: `isOpen`, `imageUrl`, `fileName`, `onClose`
- 背景クリック or ESCキーで閉じる
- 画像は `max-w-[90vw] max-h-[85vh] object-contain` で表示
- ファイル名を下部に表示

### 2. ExecutionEvidenceList の修正

**ファイル:** `apps/web/src/components/execution/ExecutionEvidenceList.tsx`

- **サムネイルサイズ拡大**: `w-8 h-8` → `w-16 h-16`（64x64px）
- **サムネイルクリックでモーダル表示**: `ImageThumbnail` にクリックハンドラ追加 → `ImagePreviewModal` を開く
- サムネイルに `cursor-pointer` と hover エフェクト追加
- コンポーネント内で `ImagePreviewModal` の state を管理（選択中の画像URL/ファイル名）

### 3. ダウンロード処理の修正

**ファイル:** `apps/web/src/pages/Execution.tsx`

- `window.open(downloadUrl, '_blank')` → `<a>` タグによる実ダウンロード処理に変更
  ```typescript
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  a.click();
  ```
- ダウンロード時にファイル名を渡すため、`handleEvidenceDownload` の引数に `fileName` を追加するか、evidenceデータから取得する

### 4. アップロード領域の折りたたみ化

**ファイル:** `apps/web/src/components/execution/ExecutionExpectedResultList.tsx`

- `isEditable` はそのまま `true`（変更なし）
- アップロード領域をデフォルト非表示にし、「エビデンスを追加」ボタンクリックで展開するトグル方式に変更
- 各期待結果ごとに展開状態を管理（`useState` で `openUploadResultId` を管理）
- ボタンは `+ エビデンスを追加` テキスト + `Plus` アイコンで小さく表示

## 修正ファイル一覧

| ファイル | 操作 |
|---------|------|
| `apps/web/src/components/common/ImagePreviewModal.tsx` | 新規作成 |
| `apps/web/src/components/execution/ExecutionEvidenceList.tsx` | 修正 |
| `apps/web/src/components/execution/ExecutionExpectedResultList.tsx` | 修正 |
| `apps/web/src/pages/Execution.tsx` | 修正 |

## 検証方法

1. テスト実行画面を開き、期待結果にエビデンス画像がある状態で確認
2. サムネイルが以前より大きくなっていること（64x64px）
3. サムネイル画像クリック → モーダルで拡大表示されること
4. モーダル内で ESC キーまたは背景クリックで閉じられること
5. ダウンロードアイコンクリック → ファイルが実際にダウンロードされること（別タブで開くのではなく）
6. アップロード領域がデフォルトで非表示、「エビデンスを追加」ボタンクリックで展開されること
7. `pnpm build` でビルドエラーがないこと
