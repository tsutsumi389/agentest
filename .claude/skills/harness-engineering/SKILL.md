---
name: harness-engineering
description: AI Coding Agentのハーネス（自律稼働の補助輪）を監査・改善するスキル。CLAUDE.md、Hooks、リンター、E2Eテスト、ADR等のハーネス構成要素を診断し、ベストプラクティスに基づいて修正提案・適用を行う。「ハーネス」「hooks」「リンター設定」「エージェント品質」「自律稼働」に関する質問がある場合に使用する。
---

# Harness Engineering - AI Coding Agent 品質制御システム

ハーネスエンジニアリングとは、AI Coding Agentを人間の介入なしに自律稼働させ、出力を安定させるための補助輪的システム設計。投資は複利で効く：リンタールール追加で以降全セッションのミス防止、テスト追加で以降全セッションの回帰検出。

## Quick Reference

| カテゴリ | 詳細 |
|---------|------|
| Hooks設計 | [references/hooks.md](references/hooks.md) |
| リンター戦略 | [references/linters.md](references/linters.md) |
| CLAUDE.md設計 | [references/claude-md.md](references/claude-md.md) |
| E2Eテスト戦略 | [references/e2e-testing.md](references/e2e-testing.md) |
| セッション管理 | [references/session-management.md](references/session-management.md) |
| アンチパターン | [references/anti-patterns.md](references/anti-patterns.md) |

## 7つの指導原則

1. **品質は仕組みで強制** - プロンプトではなくリンター・Hooks・テスト・ADRの組み合わせ
2. **フィードバックは速く** - PostToolUse(ms) > プリコミット(s) > CI(min) > 人間レビュー(h)
3. **段階的導入** - MVHから始めてミス発生のたびにハーネス強化
4. **ポインタとして設計** - CLAUDE.mdは実行可能アーティファクトへのポインタ。説明文書ではない
5. **アクセシビリティツリーはユニバーサルIF** - あらゆるアプリをE2Eテスト可能
6. **決定論的ツールを優先** - リンター・フォーマッターはLLMより安価で高速で腐敗しない
7. **セッション間の状態管理** - Gitログ・JSON進捗・起動ルーチン標準化

## ハーネス監査コマンド

このスキルが呼ばれたら、以下の手順でハーネスを監査・改善する：

### Step 1: 現状診断

以下を確認し、各項目の充足度を評価する：

```
[ ] CLAUDE.md / AGENTS.md - 50行以下か、ポインタ設計か
[ ] Hooks設定 - PreToolUse/PostToolUse/Stop が設定されているか
[ ] リンター - PostToolUseで自動実行されるか
[ ] フォーマッター - 自動修正が設定されているか
[ ] プリコミットフック - Lefthook等で品質ゲートがあるか
[ ] テスト - Stop Hookでテスト通過が完了条件か
[ ] ADR - 設計決定が構造的に記録されているか
[ ] リンター設定保護 - エージェントが設定変更できないか
[ ] セッション起動ルーチン - 標準化されているか
```

### Step 2: 優先度付き改善提案

診断結果から、以下の優先度で改善を提案する：

1. **P0（即時）**: PostToolUse Hookでリンター・フォーマッター自動実行
2. **P1（今週）**: PreToolUse Hookで破壊的操作ブロック、CLAUDE.md簡素化
3. **P2（今月）**: Stop Hookでテスト検証、カスタムリンター構築
4. **P3（将来）**: Planktonパターン、ガベージコレクション

### Step 3: 適用

ユーザーの承認を得て、具体的な設定ファイル変更を適用する。

## フィードバック階層モデル

```
Layer 1: PostToolUse Hook (ms)  → フォーマッター自動実行、リンター即座フィードバック
Layer 2: プリコミット (s)       → 全ファイルリント + 型チェック
Layer 3: CI/CD (min)            → 全テスト + 深い解析
Layer 4: 人間レビュー (h〜days) → アーキテクチャ判断
```

目標：できるだけ多くのチェックをより速いレイヤーに移動する。

## MVH（最小実行可能ハーネス）ロードマップ

### Week 1
- CLAUDE.md 50行以下にポインタ設計
- PostToolUse Hookで自動フォーマット
- プリコミットフック（Lefthook）でリンター・型チェック

### Week 2-4
- ミス発生のたびにテストまたはリンタールール追加
- 計画→承認→実行ワークフロー確立
- E2Eテストツール導入
- Stop Hookでテスト通過を完了条件に

### Month 2-3
- カスタムリンター構築（エラーメッセージに修正指示含む）
- ADRとリンタールール紐づけ
- PreToolUse Hookで安全性ゲート
