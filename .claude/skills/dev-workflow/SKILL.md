---
name: dev-workflow
description: 開発ワークフロー管理スキル。実装プラン→実装→ユニットテスト→結合テスト→ドキュメント作成の流れを、独立したエージェント（Planner, Coder, Tester, Reviewer, Documenter）で実行する。各エージェントの役割定義、チェックリスト、引き継ぎフォーマットを提供。TypeScript/Express/PostgreSQLプロジェクト向け。
---

# Development Workflow

## Overview

独立したエージェントによる開発フロー管理システム。

```
Issue → Planner → Reviewer → Coder → Reviewer → Tester → Reviewer → Documenter → Reviewer → PR
```

## Agents

| Agent | Role | Input | Output |
|-------|------|-------|--------|
| Planner | 要件を実装プランに変換 | Issue/要件 | 実装プラン |
| Coder | プランに基づいて実装 | 実装プラン | コード |
| Tester | テスト作成・実行 | コード | テスト結果 |
| Reviewer | 各成果物の品質チェック | 各フェーズ成果物 | 承認/FB |
| Documenter | ドキュメント作成・更新 | コード, プラン | ドキュメント |

## Agent Selection

エージェントとして動作する際は、該当するagentファイルを参照:

- **実装プラン作成**: [agents/planner.md](agents/planner.md)
- **コード実装**: [agents/coder.md](agents/coder.md)
- **テスト作成・実行**: [agents/tester.md](agents/tester.md)
- **レビュー**: [agents/reviewer.md](agents/reviewer.md)
- **ドキュメント作成**: [agents/documenter.md](agents/documenter.md)

## Common References

全エージェント共通の規約:

- **コーディング規約**: [common/conventions.md](common/conventions.md)
- **Git運用**: [common/git-flow.md](common/git-flow.md)
- **プロジェクト構成**: [common/project-structure.md](common/project-structure.md)

## Handoff Format

エージェント間の引き継ぎは `docs/handoffs/` に配置:

```
docs/handoffs/
├── YYYYMMDD-feature-name-plan.md      # Planner → Coder
├── YYYYMMDD-feature-name-impl.md      # Coder → Tester
├── YYYYMMDD-feature-name-test.md      # Tester → Documenter
└── YYYYMMDD-feature-name-review.md    # Reviewer feedback
```

## Quick Commands

```bash
# エージェントモードで起動（Claude Code想定）
claude --skill dev-workflow/agents/planner.md "Issue #123の実装プランを作成"
claude --skill dev-workflow/agents/coder.md "プランに基づいて実装"
claude --skill dev-workflow/agents/tester.md "テストを作成・実行"
claude --skill dev-workflow/agents/reviewer.md "実装をレビュー"
claude --skill dev-workflow/agents/documenter.md "APIドキュメントを更新"
```
