# 課金 API

個人ユーザー向けの課金機能 API です。

## 概要

- プラン一覧と料金計算
- サブスクリプション管理（アップグレード / ダウングレード予約）
- 支払い方法管理

## 認証

支払い方法およびサブスクリプション関連のエンドポイントは、Bearer トークン認証 + オーナーシップチェックが必要です。

```
Authorization: Bearer <access_token>
```

## レート制限

課金 API には専用のレート制限が適用されます。

| エンドポイント | 制限 |
|---------------|------|
| 課金関連 | 10 req / 1分 |

制限超過時は `429 Too Many Requests` を返却します。

---

## プラン

### プラン一覧取得

**認証不要**

```
GET /api/plans
```

#### レスポンス

```json
{
  "plans": {
    "FREE": {
      "monthlyPrice": 0,
      "yearlyPrice": 0,
      "features": [
        { "name": "プロジェクト数", "description": "1プロジェクト", "included": true },
        { "name": "テストケース数", "description": "100件まで", "included": true },
        { "name": "MCP連携", "description": "利用可能", "included": true },
        { "name": "チーム機能", "description": "利用不可", "included": false },
        { "name": "優先サポート", "description": "利用不可", "included": false }
      ]
    },
    "PRO": {
      "monthlyPrice": 980,
      "yearlyPrice": 9800,
      "features": [
        { "name": "プロジェクト数", "description": "無制限", "included": true },
        { "name": "テストケース数", "description": "無制限", "included": true },
        { "name": "MCP連携", "description": "利用可能", "included": true },
        { "name": "チーム機能", "description": "利用不可", "included": false },
        { "name": "優先サポート", "description": "メールサポート", "included": true }
      ]
    }
  }
}
```

---

### 料金計算

**認証必要** / **レート制限あり**

指定プラン・請求サイクルへの変更時の料金を計算します。

```
GET /api/plans/:plan/calculate
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `plan` | string | Yes | 対象プラン（`PRO`） |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `billingCycle` | string | Yes | 請求サイクル（`MONTHLY` / `YEARLY`） |

#### レスポンス

```json
{
  "calculation": {
    "plan": "PRO",
    "billingCycle": "MONTHLY",
    "price": 980,
    "yearlySavings": 1960
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `price` | 選択したサイクルでの料金（円） |
| `yearlySavings` | 年払い時の節約額（円） |

---

## サブスクリプション

### サブスクリプション取得

**認証必要** / **オーナーシップチェック**

現在のサブスクリプション情報を取得します。

```
GET /api/users/:userId/subscription
```

#### レスポンス

```json
{
  "subscription": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "plan": "PRO",
    "status": "ACTIVE",
    "billingCycle": "MONTHLY",
    "currentPeriodStart": "2025-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2025-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

#### サブスクリプションが存在しない場合

```json
{
  "subscription": null
}
```

---

### サブスクリプション作成（アップグレード）

**認証必要** / **オーナーシップチェック** / **レート制限あり**

FREE から PRO へアップグレードします。

```
POST /api/users/:userId/subscription
```

#### リクエストボディ

```json
{
  "plan": "PRO",
  "billingCycle": "MONTHLY",
  "paymentMethodId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `plan` | string | Yes | アップグレード先プラン（`PRO` のみ） |
| `billingCycle` | string | Yes | 請求サイクル（`MONTHLY` / `YEARLY`） |
| `paymentMethodId` | string (UUID) | Yes | 支払いに使用する支払い方法 ID |

#### レスポンス（201 Created）

```json
{
  "subscription": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "plan": "PRO",
    "status": "ACTIVE",
    "billingCycle": "MONTHLY",
    "currentPeriodStart": "2025-01-25T00:00:00.000Z",
    "currentPeriodEnd": "2025-02-25T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "createdAt": "2025-01-25T00:00:00.000Z",
    "updatedAt": "2025-01-25T00:00:00.000Z"
  }
}
```

#### エラー

| コード | 説明 |
|--------|------|
| 400 | バリデーションエラー（不正なプラン、支払い方法がない等） |
| 404 | ユーザーまたは支払い方法が見つからない |
| 409 | 既に有料プラン契約中 |

---

### サブスクリプションキャンセル（ダウングレード予約）

**認証必要** / **オーナーシップチェック** / **レート制限あり**

PRO プランを現在の請求期間終了時にキャンセルし、FREE プランへダウングレードを予約します。

```
DELETE /api/users/:userId/subscription
```

#### レスポンス

```json
{
  "subscription": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "plan": "PRO",
    "status": "ACTIVE",
    "billingCycle": "MONTHLY",
    "currentPeriodStart": "2025-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2025-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-25T00:00:00.000Z"
  }
}
```

`cancelAtPeriodEnd` が `true` になり、`currentPeriodEnd` 以降に FREE プランへ移行します。

#### エラー

| コード | 説明 |
|--------|------|
| 400 | 既にキャンセル予約済み |
| 404 | アクティブなサブスクリプションがない |

---

### ダウングレード予約キャンセル（サブスクリプション継続）

**認証必要** / **オーナーシップチェック** / **レート制限あり**

ダウングレード予約を取り消し、PRO プランを継続します。

```
POST /api/users/:userId/subscription/reactivate
```

#### レスポンス

```json
{
  "subscription": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "plan": "PRO",
    "status": "ACTIVE",
    "billingCycle": "MONTHLY",
    "currentPeriodStart": "2025-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2025-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-25T00:00:00.000Z"
  }
}
```

`cancelAtPeriodEnd` が `false` に戻ります。

#### エラー

| コード | 説明 |
|--------|------|
| 400 | キャンセル予約されていない |
| 404 | サブスクリプションが見つからない |

---

## 支払い方法

### 支払い方法一覧取得

**認証必要** / **オーナーシップチェック**

登録済みの支払い方法一覧を取得します。

```
GET /api/users/:userId/payment-methods
```

#### レスポンス

```json
{
  "paymentMethods": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "CARD",
      "brand": "visa",
      "last4": "4242",
      "expiryMonth": 12,
      "expiryYear": 2026,
      "isDefault": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### SetupIntent 作成

**認証必要** / **オーナーシップチェック** / **レート制限あり**

Stripe Elements でカード情報を安全に収集するための SetupIntent を作成します。

```
POST /api/users/:userId/payment-methods/setup-intent
```

#### レスポンス（200 OK）

```json
{
  "setupIntent": {
    "clientSecret": "seti_xxx_secret_xxx"
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `setupIntent.clientSecret` | フロントエンドで `stripe.confirmSetup()` に渡すクライアントシークレット |

---

### 支払い方法追加

**認証必要** / **オーナーシップチェック** / **レート制限あり**

新しい支払い方法（クレジットカード）を追加します。フロントエンドで SetupIntent を完了した後、取得した `paymentMethodId` を送信します。

```
POST /api/users/:userId/payment-methods
```

#### リクエストボディ

```json
{
  "paymentMethodId": "pm_xxxxxxxxxxxx"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `paymentMethodId` | string | Yes | Stripe の `confirmSetup()` で取得した PaymentMethod ID |

#### レスポンス（201 Created）

```json
{
  "paymentMethod": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "CARD",
    "brand": "visa",
    "last4": "4242",
    "expiryMonth": 12,
    "expiryYear": 2026,
    "isDefault": true,
    "createdAt": "2025-01-25T00:00:00.000Z"
  }
}
```

最初の支払い方法は自動的にデフォルトに設定されます。

#### エラー

| コード | 説明 |
|--------|------|
| 400 | PaymentMethod ID が無効 |

---

### 支払い方法削除

**認証必要** / **オーナーシップチェック** / **レート制限あり**

支払い方法を削除します。

```
DELETE /api/users/:userId/payment-methods/:paymentMethodId
```

#### レスポンス

`204 No Content`

#### エラー

| コード | 説明 |
|--------|------|
| 400 | アクティブなサブスクリプションで使用中の唯一の支払い方法 |
| 404 | 支払い方法が見つからない |

---

### デフォルト支払い方法設定

**認証必要** / **オーナーシップチェック** / **レート制限あり**

指定した支払い方法をデフォルトに設定します。

```
PUT /api/users/:userId/payment-methods/:paymentMethodId/default
```

#### レスポンス

```json
{
  "paymentMethod": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "CARD",
    "brand": "visa",
    "last4": "4242",
    "expiryMonth": 12,
    "expiryYear": 2026,
    "isDefault": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

#### エラー

| コード | 説明 |
|--------|------|
| 404 | 支払い方法が見つからない |

---

## Webhook

### Stripe Webhook

**認証不要**（Stripe 署名による検証）

Stripe からのイベント通知を受信します。`express.raw()` で raw body を受信し、`stripe-signature` ヘッダーで署名を検証します。

```
POST /webhooks/stripe
```

#### ヘッダー

| ヘッダー | 説明 |
|---------|------|
| `stripe-signature` | Stripe が付与する署名ヘッダー |
| `Content-Type` | `application/json` |

#### 処理するイベント

| イベント | 処理内容 |
|---------|---------|
| `invoice.paid` | 支払い完了の記録 |
| `invoice.payment_failed` | 支払い失敗の記録、サブスクリプションステータス更新 |
| `customer.subscription.created` | サブスクリプション作成 |
| `customer.subscription.updated` | サブスクリプション更新 |
| `customer.subscription.deleted` | サブスクリプションキャンセル、プランを FREE に戻す |

#### レスポンス

| コード | 説明 |
|--------|------|
| 200 | イベント処理成功 |
| 400 | 署名検証失敗 |

---

## エラーレスポンス

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ"
  }
}
```

### エラーコード

| コード | 説明 |
|--------|------|
| `VALIDATION_ERROR` | バリデーションエラー |
| `NOT_FOUND` | リソースが見つからない |
| `FORBIDDEN` | アクセス権限がない（オーナーシップ不一致） |
| `CONFLICT` | 競合（既存リソースとの重複等） |
| `PAYMENT_FAILED` | 決済処理に失敗 |
| `RATE_LIMIT_EXCEEDED` | レート制限超過 |

---

## 関連ドキュメント

- [API リファレンス](./README.md)
- [課金機能設計](../architecture/features/billing.md)
- [データベース設計 - 課金](../architecture/database/billing.md)
