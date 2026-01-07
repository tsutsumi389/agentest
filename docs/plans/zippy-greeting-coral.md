# テスト実行画面リニューアル計画

## 概要

テスト実行画面（Execution.tsx）のレイアウト変更とPicture-in-Picture（PiP）機能の追加

## 要件

1. **レイアウト変更**: サイドバー + メインパネル構成へ
   - サイドバー: テストケース一覧（進捗表示付き）
   - メイン: テストスイート概要 or 選択したテストケース詳細

2. **Picture-in-Picture機能**
   - 表示内容: 現在実行中のステップと結果入力フォーム
   - トリガー: ブラウザタブがバックグラウンドになった時に自動でPiP化
   - 操作: ドラッグ移動 + リサイズ可能
   - 使用API: Document Picture-in-Picture API（Chrome 116+）

---

## Phase 1: レイアウト変更

### 1.1 ExecutionSidebar.tsx（新規作成）
`apps/web/src/components/execution/ExecutionSidebar.tsx`

- TestCaseSidebarを参考にした実行画面専用サイドバー
- 各テストケースの進捗（PASS/FAIL/PENDING）をビジュアル表示
- 選択中のテストケースをハイライト
- 検索機能

```typescript
interface ExecutionSidebarProps {
  testCases: ExecutionTestCaseSnapshot[];
  selectedTestCaseId: string | null;
  onSelect: (testCaseId: string | null) => void;
  allExpectedResults: ExecutionExpectedResult[];
  isLoading?: boolean;
}
```

### 1.2 ExecutionOverviewPanel.tsx（新規作成）
`apps/web/src/components/execution/ExecutionOverviewPanel.tsx`

- テストケース未選択時に表示するサマリーパネル
- 現在のExecution.tsxのヘッダー・サマリーカード・スイート前提条件を移動

### 1.3 ExecutionTestCaseDetailPanel.tsx（新規作成）
`apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx`

- 選択されたテストケースの詳細表示
- ExecutionTestCaseItemの展開時コンテンツをベースにフルパネル化

### 1.4 Execution.tsx（変更）
`apps/web/src/pages/Execution.tsx`

- `usePageSidebar()` でサイドバーを動的に設定
- 選択状態の管理（URLパラメータ `?testCase=xxx`）
- メインコンテンツの条件分岐

---

## Phase 2: Picture-in-Picture機能

### 2.1 usePageVisibility.ts（新規作成）
`apps/web/src/hooks/usePageVisibility.ts`

Page Visibility APIのラッパーフック

```typescript
interface UsePageVisibilityReturn {
  isVisible: boolean;
  isHidden: boolean;
}
```

### 2.2 usePictureInPicture.ts（新規作成）
`apps/web/src/hooks/usePictureInPicture.ts`

Document Picture-in-Picture APIのラッパーフック

```typescript
interface UsePictureInPictureOptions {
  width?: number;
  height?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

interface UsePictureInPictureReturn {
  pipWindow: Window | null;
  isPipSupported: boolean;
  isPipActive: boolean;
  openPip: () => Promise<void>;
  closePip: () => void;
}
```

主要な責務:
- `documentPictureInPicture.requestWindow()` の呼び出し
- スタイルシートのPiPウィンドウへのコピー
- closeイベントハンドリング

### 2.3 PipPortal.tsx（新規作成）
`apps/web/src/components/execution/PipPortal.tsx`

ReactコンポーネントをPiPウィンドウにレンダリングするPortal

```typescript
interface PipPortalProps {
  pipWindow: Window | null;
  children: React.ReactNode;
}
```

### 2.4 PipExecutionPanel.tsx（新規作成）
`apps/web/src/components/execution/PipExecutionPanel.tsx`

PiPウィンドウ内に表示するコンパクトなパネル

- 現在のステップ/期待結果の表示
- ステータス変更ボタン
- 次へ/前へナビゲーション
- ノート入力（簡易版）

### 2.5 Execution.tsx（追加変更）

- PiP状態管理の追加
- 現在のステップ位置の追跡
- Page Visibility変更時の自動PiPトリガー
- PiPコンテンツのレンダリング

---

## 実装順序

1. `ExecutionSidebar.tsx` の作成
2. `ExecutionOverviewPanel.tsx` の作成
3. `ExecutionTestCaseDetailPanel.tsx` の作成
4. `Execution.tsx` のリファクタリング（サイドバーパターン適用）
5. 動作確認・調整
6. `usePageVisibility.ts` の作成
7. `usePictureInPicture.ts` の作成
8. `PipPortal.tsx` の作成
9. `PipExecutionPanel.tsx` の作成
10. `Execution.tsx` へのPiP機能統合
11. 最終動作確認

---

## 技術的注意点

### Document Picture-in-Picture API

- **ブラウザサポート**: Chrome 116+のみ（Safari、Firefoxは未サポート）
- フィーチャー検出: `'documentPictureInPicture' in window`
- 非対応ブラウザでは機能を非表示に

### スタイルシートのコピー

```typescript
[...document.styleSheets].forEach((styleSheet) => {
  try {
    const cssRules = [...styleSheet.cssRules].map(r => r.cssText).join('');
    const style = document.createElement('style');
    style.textContent = cssRules;
    pipWindow.document.head.appendChild(style);
  } catch (e) {
    // CORSエラーの場合はlinkタグで参照
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleSheet.href;
    pipWindow.document.head.appendChild(link);
  }
});
```

### 自動PiPトリガーの条件

- タブがhiddenになった時
- 実行中（IN_PROGRESS）の場合のみ
- PiPがサポートされている場合のみ
- 既にPiPが開いていない場合のみ

---

## 変更ファイル一覧

### 新規作成（8ファイル）
- `apps/web/src/components/execution/ExecutionSidebar.tsx`
- `apps/web/src/components/execution/ExecutionOverviewPanel.tsx`
- `apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx`
- `apps/web/src/components/execution/PipPortal.tsx`
- `apps/web/src/components/execution/PipExecutionPanel.tsx`
- `apps/web/src/hooks/usePageVisibility.ts`
- `apps/web/src/hooks/usePictureInPicture.ts`
- `apps/web/src/types/document-pip.d.ts`（型定義）

### 変更（1ファイル）
- `apps/web/src/pages/Execution.tsx`

---

## 参考ファイル

- `apps/web/src/components/test-suite/TestCaseSidebar.tsx` - サイドバー実装パターン
- `apps/web/src/components/Layout.tsx` - PageSidebarContext
- `apps/web/src/components/execution/ExecutionResultItem.tsx` - 結果入力UI
