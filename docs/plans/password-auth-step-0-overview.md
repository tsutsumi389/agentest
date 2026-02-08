# メール/パスワード認証 — TDD実装ステップ総覧

## 元の計画

[dreamy-strolling-canyon.md](./dreamy-strolling-canyon.md)

## 実装ステップ一覧

| ステップ | ファイル | 内容 | 依存 | TDD対象 |
|---------|---------|------|------|---------|
| 1 | [step-1](./password-auth-step-1-schema-validation.md) | DBスキーマ + バリデーションスキーマ | なし | バリデーションのみ |
| 2 | [step-2](./password-auth-step-2-auth-service.md) | パスワード認証サービス | Step 1 | ユニットテスト |
| 3 | [step-3](./password-auth-step-3-email-templates.md) | メールテンプレート | Step 1 | ユニットテスト |
| 4 | [step-4](./password-auth-step-4-auth-endpoints.md) | 認証APIエンドポイント（login/register/reset） | Step 2, 3 | 統合テスト |
| 5 | [step-5](./password-auth-step-5-password-management-endpoints.md) | パスワード管理APIエンドポイント | Step 2 | 統合テスト |
| 6 | [step-6](./password-auth-step-6-login-register-ui.md) | フロントエンド — ログイン/サインアップ | Step 4 | コンポーネントテスト |
| 7 | [step-7](./password-auth-step-7-password-reset-ui.md) | フロントエンド — パスワードリセット | Step 4 | コンポーネントテスト |
| 8 | [step-8](./password-auth-step-8-settings-ui.md) | フロントエンド — 設定画面パスワード管理 | Step 5 | コンポーネントテスト |

## 依存関係図

```
Step 1: DBスキーマ + バリデーション
  ├─→ Step 2: 認証サービス ─────┬─→ Step 4: 認証API ─────┬─→ Step 6: ログイン/登録UI
  │                             │                        └─→ Step 7: リセットUI
  ├─→ Step 3: メールテンプレート ─┘
  │
  └─→ Step 5: パスワード管理API ──→ Step 8: 設定画面UI
```

## 各ステップの進め方

各ステップ内で以下のTDDサイクルを繰り返す:

1. **RED**: テストを先に書く（失敗する状態）
2. **GREEN**: 最小限の実装でテストを通す
3. **REFACTOR**: コードを整理する
4. **BUILD**: `docker compose exec dev pnpm build` で型チェック
5. **TEST**: `docker compose exec dev pnpm test` で全テスト通過確認
