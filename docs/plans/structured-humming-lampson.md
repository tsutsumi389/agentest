# MCP Apps実装の修正計画

**ステータス: 計画中**

## 問題点

現在のMCP Apps実装を参照コードと比較した結果、以下の問題を特定しました。

### 1. ハンドラー登録順序の問題（重大）

**問題**: `app.connect()` の前にすべてのハンドラーを登録する必要があるが、現在は `ontoolresult` のみ登録。

**現在のコード** (`app.ts:182-203`):
```typescript
app.ontoolresult = (result) => { ... };
app.connect();
```

**必要なハンドラー**:
- `onteardown` - アプリ終了時の処理
- `ontoolinput` - ツール入力を受け取ったとき
- `ontoolresult` - ツール結果を受け取ったとき（実装済み）
- `onhostcontextchanged` - ホストコンテキスト変更時
- `onerror` - エラー処理

### 2. ホストスタイル統合の欠如（重大）

**問題**: ホストのテーマ、CSS変数、フォント、セーフエリアを適用していない。ハードコードされたスタイルを使用している。

**必要な処理**:
```typescript
import { applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    // セーフエリアのパディング適用
  }
};
```

### 3. connect()後のコンテキスト初期化

**問題**: `app.connect()` 後に初期コンテキストを取得・適用していない。

**必要な処理**:
```typescript
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
```

### 4. CSS変数の未使用

**問題**: `index.html` でハードコードされた色（`#0a0a0a`, `#e5e5e5` 等）を使用している。ホストのCSS変数（`--color-background-*`, `--color-text-*` 等）を使用すべき。

## 修正計画

### ステップ1: app.tsの修正

**ファイル**: `apps/mcp-server/src/apps/test-suites-app/app.ts`

1. 必要なインポートを追加:
   ```typescript
   import {
     App,
     applyDocumentTheme,
     applyHostStyleVariables,
     applyHostFonts,
     type McpUiHostContext,
   } from '@modelcontextprotocol/ext-apps';
   ```

2. ホストコンテキスト変更ハンドラーを追加:
   ```typescript
   const mainEl = document.getElementById('app')!;

   function handleHostContextChanged(ctx: McpUiHostContext) {
     if (ctx.theme) {
       applyDocumentTheme(ctx.theme);
     }
     if (ctx.styles?.variables) {
       applyHostStyleVariables(ctx.styles.variables);
     }
     if (ctx.styles?.css?.fonts) {
       applyHostFonts(ctx.styles.css.fonts);
     }
     if (ctx.safeAreaInsets) {
       mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
       mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
       mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
       mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
     }
   }
   ```

3. すべてのハンドラーを `connect()` の前に登録:
   ```typescript
   // 1. ハンドラーを先に登録
   app.onteardown = async () => {
     console.info('App is being torn down');
     return {};
   };

   app.ontoolinput = (params) => {
     console.info('Received tool input:', params);
   };

   app.ontoolresult = (result) => { /* 既存の処理 */ };

   app.onerror = console.error;

   app.onhostcontextchanged = handleHostContextChanged;

   // 2. 接続
   app.connect().then(() => {
     const ctx = app.getHostContext();
     if (ctx) {
       handleHostContextChanged(ctx);
     }
   });
   ```

### ステップ2: index.htmlのCSS修正

**ファイル**: `apps/mcp-server/src/apps/test-suites-app/index.html`

ハードコードされた色をCSS変数に置き換え、フォールバック値を設定:

```css
body {
  font-family: var(--font-mono, 'SF Mono', Monaco, monospace);
  background: var(--color-background-primary, #0a0a0a);
  color: var(--color-text-primary, #e5e5e5);
}

.header h1 {
  color: var(--color-text-primary, #fafafa);
}

.header .count {
  color: var(--color-text-secondary, #737373);
}

.test-suite-card {
  background: var(--color-background-secondary, #171717);
  border: 1px solid var(--color-border-primary, #262626);
  border-radius: var(--border-radius-md, 6px);
}
/* ... 他のスタイルも同様 */
```

### ステップ3: global.cssの追加（オプション）

参照コードでは `global.css` をインポートしているが、必須ではない。`index.html` 内のスタイルで十分。

## 重要な修正ファイル

| ファイル | 修正内容 |
|---------|---------|
| `apps/mcp-server/src/apps/test-suites-app/app.ts` | ハンドラー追加、ホストスタイル統合 |
| `apps/mcp-server/src/apps/test-suites-app/index.html` | CSS変数使用に変更 |

## 検証方法

1. `docker compose exec dev pnpm --filter mcp-server build` でビルド確認
2. MCP InspectorまたはClaude Desktopでツールを呼び出し
3. ホストのテーマ（ライト/ダーク）に応じてUIが変化することを確認
4. テスト実行依頼ボタンが正常に動作することを確認
