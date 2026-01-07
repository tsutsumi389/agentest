# GitHub Flavored Markdown エディタ実装計画

## 概要

テストスイート・テストケースの各フィールドをGitHub Flavored Markdown (GFM) に対応させる。
- 対象: 説明、前提条件、ステップ、期待結果
- UI: Write/Previewタブ、ツールバー付きエディタ

## ライブラリ選定

```bash
docker compose exec dev pnpm --filter @agentest/web add react-markdown remark-gfm
```

| ライブラリ | 用途 |
|-----------|------|
| `react-markdown` | Markdownレンダリング（軽量、Reactネイティブ） |
| `remark-gfm` | GFM対応（テーブル、タスクリスト、取り消し線等） |

## 新規コンポーネント

```
apps/web/src/components/common/markdown/
├── MarkdownEditor.tsx    # Write/Preview切替、ツールバー統合
├── MarkdownPreview.tsx   # Markdownレンダリング（表示専用）
└── MarkdownToolbar.tsx   # 書式ボタン群
```

### MarkdownEditor UI構造

```
┌─────────────────────────────────────────────────────────┐
│ [Write] [Preview]                                       │ ← タブ
├─────────────────────────────────────────────────────────┤
│ [H▼][B][I][~~][•][1.][>][</>][🔗]                      │ ← ツールバー
├─────────────────────────────────────────────────────────┤
│ Markdown入力 / プレビュー表示                          │
└─────────────────────────────────────────────────────────┘
```

### ツールバーボタン

| アイコン | 機能 | 挿入 |
|---------|------|------|
| H▼ | 見出し | `# `, `## `, `### ` |
| B | 太字 | `**text**` |
| I | 斜体 | `*text*` |
| ~~ | 取り消し線 | `~~text~~` |
| • | 箇条書き | `- ` |
| 1. | 番号付き | `1. ` |
| > | 引用 | `> ` |
| </> | コード | `` `code` `` |
| 🔗 | リンク | `[text](url)` |

## 修正対象ファイル

### 編集側

| ファイル | 修正内容 |
|---------|---------|
| `DynamicListSection.tsx` | `useMarkdown` Prop追加、コンパクトモード対応 |
| `TestSuiteForm.tsx` | 説明→MarkdownEditor、前提条件に`useMarkdown={true}` |
| `TestCaseForm.tsx` | 説明→MarkdownEditor、各リストに`useMarkdown={true}` |
| `TestCaseItemFormModal.tsx` | textarea→MarkdownEditor |

### 表示側

| ファイル | 修正内容 |
|---------|---------|
| `TestCaseDetailPanel.tsx` | 説明をMarkdownPreviewで表示 |
| `TestCaseStepList.tsx` | step.contentをMarkdownPreviewで表示 |
| `TestCasePreconditionList.tsx` | precondition.contentをMarkdownPreviewで表示 |
| `TestCaseExpectedResultList.tsx` | expectedResult.contentをMarkdownPreviewで表示 |

### スタイル

| ファイル | 修正内容 |
|---------|---------|
| `globals.css` | Markdownプレビュー用スタイル追加 |

## 実装ステップ

### Phase 1: 基盤コンポーネント
1. パッケージインストール（react-markdown, remark-gfm）
2. `MarkdownPreview.tsx` 作成
3. `MarkdownToolbar.tsx` 作成
4. `MarkdownEditor.tsx` 作成
5. `globals.css` にMarkdownスタイル追加

### Phase 2: 表示側統合
6. `TestCaseDetailPanel.tsx` 修正
7. `TestCaseStepList.tsx` 修正
8. `TestCasePreconditionList.tsx` 修正
9. `TestCaseExpectedResultList.tsx` 修正

### Phase 3: 編集側統合
10. `DynamicListSection.tsx` 拡張
11. `TestSuiteForm.tsx` 修正
12. `TestCaseForm.tsx` 修正
13. `TestCaseItemFormModal.tsx` 修正

### Phase 4: 仕上げ
14. ダークテーマ整合性確認・調整
15. （オプション）キーボードショートカット追加

## 注意点

- **XSS対策**: `react-markdown`はデフォルトでサニタイズ済み
- **後方互換性**: 既存プレーンテキストデータはそのままMarkdownとして表示可能
- **バンドルサイズ**: 約25KB (gzip) 追加
