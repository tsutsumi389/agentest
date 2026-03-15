# E2Eテスト戦略

## 基本原則

エージェントは自分が書いたコードを「見る」手段がなければ、コンパイル通っただけで「完了」宣言する。E2Eテストでエージェントに実際のUI/APIを検証させる。

## アプリタイプ別テスト戦略

| アプリタイプ | インターフェース | 推奨ツール |
|-------------|-----------------|-----------|
| Web | アクセシビリティツリー | Playwright CLI / agent-browser |
| Mobile (iOS) | アクセシビリティツリー | XcodeBuildMCP / mobile-mcp |
| Mobile (Android) | アクセシビリティツリー | mobile-mcp / Appium MCP |
| CLI | 標準出力/エラー出力 | bats-core / pexpect |
| API | HTTPレスポンス | Hurl |
| Desktop (Electron) | Chromiumアクセシビリティツリー | Playwright / WebdriverIO |
| Desktop (Native) | OSアクセシビリティAPI | Terminator(Win) / macos-ui-automation-mcp |
| Infra | Plan出力/スキーマ | terraform test / conftest |

## Webアプリ：3つのアプローチ

### 1. Playwright MCP（Microsoft公式）
- アクセシビリティツリーベース
- 26+ツール定義がコンテキスト消費（約114,000トークン）
- テスト「生成」に使い、生成されたテストをCIで独立実行が現実的

### 2. Playwright CLI（`@playwright/cli`）推奨
- MCP比で約4倍のトークン効率（約27,000トークン）
- Claude Code・Codex E2Eテスト主力ツール

### 3. agent-browser（Vercel Labs）
- 最高トークン効率（MCP比5.7倍効率）
- 要素参照（@e1, @e2...）でCSSセレクター脆さ回避
- 2ヶ月でまだ荒い。Windows対応に未解決issue

## アクセシビリティツリー vs スクリーンショット

### ツリーが適する場面
- プログラム的操作：role/name/stateで要素操作
- 決定論的テスト：同ページは同ツリー返す
- 操作自動化：フォーム入力、ナビゲーション

### スクリーンショットが適する場面
- ビジュアルバグ検出：レイアウト崩れ、CSS不具合
- 視覚的回帰テスト
- Canvas・チャート・地図・画像

## API/バックエンドE2Eテスト

### Hurl（推奨）
プレーンテキストでHTTPリクエストとアサーション定義。Rust製軽量バイナリ。

```
POST http://localhost:3000/api/users
Content-Type: application/json
{
  "name": "Test User",
  "email": "test@example.com"
}
HTTP 201
[Asserts]
jsonpath "$.id" exists
jsonpath "$.name" == "Test User"
```

### Pact
マイクロサービスAPI契約検証。エージェントがコンシューマーテスト生成 → CIプロバイダー検証。

## CLI/TUIアプリ

### bats-core
```bash
@test "help flag shows usage" {
  run ./mycli --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}
```

ベストプラクティス：メインロジックを`run_main`関数に移動し、`if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then run_main; fi`で囲む。

## アニメーション・トランジション検証

| Layer | タイミング | 手法 |
|-------|-----------|------|
| 1 | PostToolUse(ms) | `getAnimations()` APIでアニメーション完了保証 |
| 2 | PostToolUse(ms) | CLS計測 |
| 3 | CI(s) | アニメーション凍結+スナップショット比較 |
| 4 | Stop Hook | 5fpsフレーム列撮影→エージェント直接視認 |

## 共通原則

検証結果をフィードバックとしてエージェントに返し、自己修正ループを閉じる。
