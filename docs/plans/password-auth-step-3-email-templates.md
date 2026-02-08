# Step 3: メールテンプレート

## 概要

パスワードリセットメールとウェルカムメール（サインアップ完了通知）のテンプレートを追加する。
既存の `email.service.ts` のHTMLスタイルと `escapeHtml` / `sanitizeUrl` パターンを踏襲。

## 前提条件

- [Step 1](./password-auth-step-1-schema-validation.md) 完了

## 再利用する既存実装

| パターン | ファイル |
|---------|---------|
| HTMLメールテンプレート構造 | `apps/api/src/services/email.service.ts` — `generateAdminInvitationEmail` |
| XSS対策 | `escapeHtml()`, `sanitizeUrl()` |
| メール送信インターフェース | `EmailContent { subject, text, html }` |

---

## 変更ファイル: `apps/api/src/services/email.service.ts`

## テストファイル: `apps/api/src/services/__tests__/email-templates.test.ts`

---

## TDD: テストケース一覧

### generatePasswordResetEmail

```
- EmailContent（subject, text, html）を返す
- subjectに「パスワードリセット」が含まれる
- htmlにリセットURLが含まれる
- htmlにユーザー名が含まれる
- htmlに有効期限の説明が含まれる
- ユーザー名にHTMLタグが含まれる場合にエスケープされる
- リセットURLにjavascript:が含まれる場合にサニタイズされる
- textにリセットURL（プレーンテキスト）が含まれる
```

### generateWelcomeEmail

```
- EmailContent（subject, text, html）を返す
- subjectに「ようこそ」または「アカウント作成」が含まれる
- htmlにユーザー名が含まれる
- htmlにログインURLが含まれる
- ユーザー名にHTMLタグが含まれる場合にエスケープされる
```

---

## 実装のポイント

### メソッドシグネチャ

```typescript
// パスワードリセットメール
generatePasswordResetEmail(params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailContent

// ウェルカムメール
generateWelcomeEmail(params: {
  name: string;
  loginUrl: string;
}): EmailContent
```

### 既存のHTMLスタイルを踏襲

- 日本語メール本文
- レスポンシブHTMLレイアウト（既存テンプレートのCSSを再利用）
- テキスト版も必ず用意（HTMLメールが表示できないクライアント対策）

---

## 検証

```bash
# メールテンプレートテスト
docker compose exec dev pnpm --filter @agentest/api test -- --run email-templates

# ビルド確認
docker compose exec dev pnpm build
```

## 成果物

### 変更ファイル
- `apps/api/src/services/email.service.ts` — テンプレートメソッド追加

### 新規ファイル
- `apps/api/src/services/__tests__/email-templates.test.ts`

## 次のステップ

→ [Step 4: 認証APIエンドポイント](./password-auth-step-4-auth-endpoints.md)
