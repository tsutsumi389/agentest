# 初回セットアップ API

## 概要

初回セットアップ API。システムに管理者ユーザー（AdminUser）が0件の場合のみ動作し、最初の SUPER_ADMIN アカウントを作成する。

認証不要のエンドポイントだが、POST リクエストには CSRF 保護（Origin/Referer ヘッダー検証）が適用される。

## ベース URL

```
/admin/setup
```

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/admin/setup/status` | セットアップ状態確認 |
| POST | `/admin/setup` | 初回セットアップ実行 |

---

## エンドポイント

### セットアップ状態確認

```
GET /admin/setup/status
```

AdminUser が存在するかどうかを確認し、初回セットアップが必要かどうかを返却する。

**Request:**

パラメータなし。認証不要。

**Response:**

```json
{
  "isSetupRequired": true
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `isSetupRequired` | boolean | `true`: セットアップ必要（AdminUser = 0件）、`false`: セットアップ済み |

---

### 初回セットアップ実行

```
POST /admin/setup
```

最初の SUPER_ADMIN アカウントを作成する。AdminUser が既に存在する場合は実行できない。

CSRF 保護が適用されるため、リクエストには有効な `Origin` または `Referer` ヘッダーが必要。

**Request:**

```json
{
  "email": "admin@example.com",
  "name": "管理者太郎",
  "password": "SecureP@ss1"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `email` | Yes | string | メールアドレス（最大255文字、自動で小文字化・トリム） |
| `name` | Yes | string | 管理者の表示名（1〜100文字、自動でトリム） |
| `password` | Yes | string | パスワード（8〜100文字） |

**パスワード要件:**

| 要件 | 説明 |
|------|------|
| 最小文字数 | 8文字以上 |
| 大文字 | 1文字以上含む（A-Z） |
| 小文字 | 1文字以上含む（a-z） |
| 数字 | 1文字以上含む（0-9） |
| 記号 | 1文字以上含む（`!@#$%^&*()_+-=[]{}';:"\|,.<>/?`） |

**Response (201 Created):**

```json
{
  "admin": {
    "email": "admin@example.com",
    "name": "管理者太郎"
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `admin.email` | string | 作成された管理者のメールアドレス |
| `admin.name` | string | 作成された管理者の表示名 |

**Errors:**

| コード | HTTP | 説明 |
|-------|------|------|
| `VALIDATION_ERROR` | 400 | 入力内容に誤りがある（メール形式不正、パスワード要件未達等） |
| `AUTHORIZATION_ERROR` | 403 | セットアップは既に完了している |
| `forbidden` | 403 | CSRF 検証失敗（Origin/Referer ヘッダーが無効） |

**バリデーションエラーの詳細形式:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります",
    "statusCode": 400,
    "details": {
      "email": ["有効なメールアドレスを入力してください"],
      "password": ["パスワードは8文字以上で入力してください"]
    }
  }
}
```

---

## CSRF 保護

POST `/admin/setup` には CSRF 保護が適用される。

**検証方法:** リクエストの `Origin` または `Referer` ヘッダーを許可されたオリジンと照合する。

**許可されるオリジン:**

| 環境変数 | デフォルト値 |
|---------|------------|
| `FRONTEND_URL` | `http://localhost:5173` |
| `ADMIN_FRONTEND_URL` | `http://localhost:5174` |
| `API_BASE_URL` | 設定による |

**CSRF エラーレスポンス:**

```json
{
  "error": "forbidden",
  "error_description": "Invalid request origin"
}
```

---

## セキュリティ

| 項目 | 対策 |
|------|------|
| パスワードハッシュ | bcrypt（コストファクター: 12） |
| CSRF保護 | Origin/Refererヘッダー検証 |
| 競合防止 | PostgreSQL Serializable トランザクション |
| メール正規化 | 小文字化・トリム処理 |
| 監査ログ | IPアドレス・User-Agentを記録 |
| ID非公開 | レスポンスに内部IDを含めない |

---

## 使用例

### JavaScript (fetch)

```javascript
// セットアップ状態を確認
const statusResponse = await fetch('/admin/setup/status');
const { isSetupRequired } = await statusResponse.json();

if (isSetupRequired) {
  // 初回セットアップを実行
  const setupResponse = await fetch('/admin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: 'admin@example.com',
      name: '管理者太郎',
      password: 'SecureP@ss1'
    })
  });

  if (setupResponse.ok) {
    const { admin } = await setupResponse.json();
    // セットアップ成功 → ログイン画面へ遷移
  } else {
    const error = await setupResponse.json();
    // エラーハンドリング
  }
}
```

---

## 関連ドキュメント

- [システム管理者機能](../architecture/features/admin-system.md)
- [管理者認証 API](./admin-auth.md)
- [API 設計方針](../architecture/api-design.md)
