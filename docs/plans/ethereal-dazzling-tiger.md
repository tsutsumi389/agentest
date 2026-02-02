# MCP Apps機能実装計画

**ステータス: 実装完了**

## 概要

MCP ServerにMCP Apps機能を追加し、テストスイート一覧を表示するインタラクティブUIと、テスト実行をLLMに依頼する機能を実装した。

## 要件

1. テストスイートの一覧を表示するUI
2. テスト実行ボタンをクリックすると、LLMに対象のテストスイートのテスト実行を依頼

## 技術スタック

- **MCP Apps**: `@modelcontextprotocol/ext-apps`パッケージ
- **UIバンドル**: Vite + vite-plugin-singlefile
- **UI実装**: Vanilla TypeScript（軽量化のため）
- **テスト実行依頼**: Sampling機能またはコンテキスト更新

## 実装計画

### 1. 依存関係の追加

**ファイル**: `apps/mcp-server/package.json`

```json
{
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.0.1"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^0.13.0"
  }
}
```

### 2. ディレクトリ構造

```
apps/mcp-server/
├── src/
│   ├── apps/                        # MCP Apps（新規）
│   │   ├── test-suites-app/
│   │   │   ├── index.html          # UIテンプレート
│   │   │   └── app.ts              # UIロジック
│   │   └── index.ts                # Apps登録
│   ├── tools/
│   │   └── show-test-suites-app.ts # Appツール（新規）
│   └── ...
├── vite.config.ts                   # Vite設定（新規）
└── package.json
```

### 3. ビルド設定

**ファイル**: `apps/mcp-server/vite.config.ts`

UIを単一HTMLファイルにバンドル。

### 4. Appツール実装

**ファイル**: `apps/mcp-server/src/tools/show-test-suites-app.ts`

- `show_test_suites_app`ツールを追加
- `_meta.ui.resourceUri`でUIリソースを指定
- 初期データとしてテストスイート一覧を返す

### 5. UI実装

**ファイル**: `apps/mcp-server/src/apps/test-suites-app/`

- テストスイート一覧をカード形式で表示
- ステータスバッジ、テストケース数を表示
- 「テスト実行を依頼」ボタンを配置

### 6. Apps登録

**ファイル**: `apps/mcp-server/src/apps/index.ts`

`registerAppTool`と`registerAppResource`を使用。

### 7. server.ts修正

**ファイル**: `apps/mcp-server/src/server.ts`

`registerApps()`を追加してApp登録を実行。

## 重要な修正ファイル

| ファイル | 操作 |
|---------|------|
| `apps/mcp-server/package.json` | 依存関係追加 |
| `apps/mcp-server/vite.config.ts` | 新規作成 |
| `apps/mcp-server/src/server.ts` | Apps登録追加 |
| `apps/mcp-server/src/apps/index.ts` | 新規作成 |
| `apps/mcp-server/src/apps/test-suites-app/index.html` | 新規作成 |
| `apps/mcp-server/src/apps/test-suites-app/app.ts` | 新規作成 |
| `apps/mcp-server/src/tools/show-test-suites-app.ts` | 新規作成 |

## テスト実行依頼の方式

**採用: sendMessage()使用**
- UIから`app.sendMessage()`で会話にメッセージを追加
- LLMがメッセージに応答し、`create_execution`ツールを呼び出して実行
- MCP Apps標準の通信方式

```typescript
// UIからのメッセージ送信例
await app.sendMessage({
  role: 'user',
  content: {
    type: 'text',
    text: `テストスイート「${suiteName}」（ID: ${suiteId}）のテスト実行を開始してください。
create_executionツールを使用してテスト実行を開始し、結果を記録してください。`,
  },
});
```

## 検証方法

- [x] `pnpm build`でUIがバンドルされることを確認
- [x] MCP Inspectorでツールが登録されていることを確認
- [x] Claude DesktopでUIが表示されることを確認
- [x] テスト実行ボタンの動作確認

## 参考資料

- [MCP Apps Documentation](https://modelcontextprotocol.io/docs/extensions/apps)
- [ext-apps GitHub](https://github.com/modelcontextprotocol/ext-apps)
- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling)
