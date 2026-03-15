# リンター戦略

## 基本原則

> LLMは従来のリンターやフォーマッターと比較して高価で遅い。決定論的ツール使用可能な場面では常にそちらを使うべき。

リンター・フォーマッター・型チェッカーは腐敗しない。設定変更でCIが壊れるので即座に検出される。

## 言語別推奨スタック（2026年3月）

### TypeScript/Node.js

| レイヤー | ツール | 目的 | 速度 |
|---------|--------|------|------|
| PostToolUse | Biome → Oxlint | 自動フォーマット+高速リント | ms |
| プリコミット | Lefthook → Oxlint + tsc | 全ファイルリント+型チェック | s |
| CI | ESLint(カスタム)+テスト | 深い解析 | min |

**Oxlint（Rust製）**: ESLint 50-100倍高速。520+ ESLint互換ルール。
**Biome（Rust製）**: ESLint+Prettier 10-25倍高速。v2.0でGritQLプラグイン対応。

### Python

| レイヤー | ツール | 目的 | 速度 |
|---------|--------|------|------|
| PostToolUse | Ruff check --fix → Ruff format | 自動修正+フォーマット | ms |
| プリコミット | Lefthook → Ruff + mypy | 全リント+型チェック | s |
| CI | Ruff + mypy + pytest | 全解析+テスト | min |

### Go

| レイヤー | ツール | 目的 | 速度 |
|---------|--------|------|------|
| PostToolUse | gofumpt + golangci-lint | フォーマット+高速リント | ms |
| プリコミット | Lefthook → golangci-lint --fix | 全リント+自動修正 | s |
| CI | golangci-lint + go test | 全解析+テスト | min |

## カスタムリンター戦略（4カテゴリ）

### 1. Grep-ability（検索容易性）
- default exportよりnamed export強制
- 一貫したエラー型と明示的DTO
- エージェントgrep走査時の命中精度向上

### 2. Glob-ability（配置予測可能性）
- ファイル構造を予測可能に保つ
- エージェントの配置・発見・リファクタリング容易化

### 3. アーキテクチャ境界
- クロスレイヤーインポートブロック
- 依存方向を機械的に強制

### 4. セキュリティ/プライバシー
- 平文シークレットブロック
- 入力スキーマバリデーション強制
- `eval`/`new Function`禁止

## エラーメッセージを修正指示に

最も巧妙な手法。エラーメッセージが修正方法も伝える：

```
ERROR: [何が間違っているか]
  [どのファイル:行番号]
  WHY: [ルール理由、ADRリンク]
  FIX: [具体的修正手順、コード例]
  EXAMPLE:
    // Bad: import { foo } from '../internal/foo'
    // Good: import { foo } from '@app/foo'
```

## AI生成コード固有のアンチパターン

1. **any乱用** - `@typescript-eslint/no-explicit-any: error`で強制
2. **コード重複** - jscpdで検知
3. **ゴーストファイル** - 既存修正ではなく新規作成。命名規則で強制
4. **コメント洪水** - AI生成で90-100%がComments Everywhereパターン
5. **セキュリティ脆弱性** - AI生成コード36-40%に脆弱性。セキュリティリンター必須

## Planktonパターン（高度）

PostToolUseフックで20+リンター実行、違反を構造化JSON化。複雑さに応じてHaiku/Sonnet/Opusに修正ルーティング。

3フェーズ：
1. サイレント自動フォーマット（40-50%問題解消）
2. 残り違反を構造化JSON化
3. サブプロセスに修正委任
