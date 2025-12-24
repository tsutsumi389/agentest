# GitHub Copilot Settings

> **Note**: このプロジェクトのメイン開発環境はClaude Codeです。  
> 詳細なプロジェクト情報は [CLAUDE.md](../CLAUDE.md) を参照してください。

## Language Settings

**IMPORTANT**: GitHub Copilotが生成する以下のコンテンツは**必ず日本語**で作成してください：

- ✅ **コミットメッセージ**
- ✅ **プルリクエストのタイトル・説明**
- ✅ **コードレビューコメント**
- ✅ **Issue の説明・コメント**
- ✅ **ドキュメント**

### Examples

```bash
# ✅ Good - 日本語
feat(api): ユーザー認証エンドポイントを追加

# ❌ Bad - 英語
feat(api): add user authentication endpoint
```

```markdown
# ✅ Good - PR Description
## 概要
ユーザー認証機能を実装しました。

## 変更内容
- GitHub OAuth認証の追加
- JWTトークン生成機能
- 認証ミドルウェアの実装

# ❌ Bad - PR Description
## Summary
Implemented user authentication feature.
```

## Quick Reference

プロジェクト構造や開発ワークフローの詳細は [CLAUDE.md](../CLAUDE.md) を参照してください。

### Essential Commands

```bash
# 全てDockerコンテナ経由で実行
docker compose exec dev pnpm install
docker compose exec dev pnpm test
docker compose exec dev pnpm lint
```

### Key Documentation

- [CLAUDE.md](../CLAUDE.md) - 詳細な開発ガイド（メイン）
- [Architecture](../docs/architecture/overview.md) - システム設計
- [API Design](../docs/architecture/api-design.md) - API規約
