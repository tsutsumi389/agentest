# テストスイート編集フォーム実装計画

## 概要
テストスイートの名前・説明・前提条件をフォームで編集できるようにする。テストケースと同様のパターンで、ヘッダーに編集ボタンを追加し、クリックするとフォームモードに切り替わる。

## 実装内容

### 1. TestSuiteFormコンポーネント作成
**ファイル**: `apps/web/src/components/test-suite/TestSuiteForm.tsx`

テストケースの `TestCaseForm` パターンを参考に作成。

**props**:
- `mode`: 'edit'（現状は編集のみ）
- `testSuite`: TestSuite（編集対象、前提条件含む）
- `onSave`: () => void
- `onCancel`: () => void

**フォーム項目**:
- 名前（必須、最大100文字）
- 説明（任意、最大500文字）
- ステータス（DRAFT / ACTIVE / ARCHIVED）
- **前提条件**（動的リスト）- `TestCaseForm`の`DynamicListSection`パターンを流用

**機能**:
- 変更検出（hasChanges）
- キャンセル時の確認ダイアログ
- ブラウザ閉じる警告（beforeunload）
- バリデーション
- 保存中のローディング表示
- 前提条件のドラッグ&ドロップ並び替え

### 2. TestSuiteDetailPage修正
**ファイル**: `apps/web/src/pages/TestSuiteDetail.tsx`

**変更内容**:
1. `isEditMode` state追加
2. ヘッダーに編集ボタン（Pencilアイコン）追加
3. 編集モード時は `TestSuiteForm` を表示（ページ全体をフォームに置き換え）

**編集ボタンの権限**: `canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE'`

### 3. 前提条件の差分更新ロジック
`TestCaseForm`の`updateListItems`関数を参考に実装：
- 削除された項目: `testSuitesApi.deletePrecondition`
- 新規追加された項目: `testSuitesApi.addPrecondition`
- 更新された項目: `testSuitesApi.updatePrecondition`
- 並び替え: `testSuitesApi.reorderPreconditions`

## 参考ファイル
- `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` - 編集モード切り替えパターン
- `apps/web/src/components/test-case/TestCaseForm.tsx` - フォーム実装パターン + DynamicListSection
- `apps/web/src/components/project/ProjectGeneralSettings.tsx` - 名前・説明編集フォーム

## API（既存）
- `testSuitesApi.update(testSuiteId, { name, description, status })`
- `testSuitesApi.addPrecondition(testSuiteId, { content })`
- `testSuitesApi.updatePrecondition(testSuiteId, preconditionId, { content })`
- `testSuitesApi.deletePrecondition(testSuiteId, preconditionId)`
- `testSuitesApi.reorderPreconditions(testSuiteId, ids)`

## 実装手順
1. `TestSuiteForm.tsx` を作成（DynamicListSectionを`TestCaseForm`からコピーまたは共通化）
2. `TestSuiteDetail.tsx` に編集モードを追加
3. 動作確認
