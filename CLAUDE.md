# Agentest

テスト管理ツール。MCPでAI Coding Agentと連携。

## コマンド

```bash
cd docker && docker compose up           # 開発サーバー起動
docker compose exec dev pnpm install     # 依存インストール
docker compose exec dev pnpm test        # テスト実行
docker compose exec dev pnpm build       # ビルド
docker compose exec dev pnpm lint        # リント
```

## 構造

```
apps/   admin/ api/ jobs/ mcp-server/ web/ ws/
packages/   auth/ db/ shared/ storage/ ui/ ws-types/
```

## 規約

- コメントは日本語
- ADR: `docs/adr/`
- Hooks: `.claude/hooks/` で品質ゲート自動実行

## 詳細

- [アーキテクチャ](docs/architecture/overview.md)
- [開発ガイド](docs/guides/development.md)
- [API設計](docs/architecture/api-design.md)
