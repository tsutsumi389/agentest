# 課金・サブスクリプション テーブル

## 概要

ユーザー/組織のサブスクリプション管理、請求書、支払い方法を管理するテーブル。

## Subscription

サブスクリプション情報を管理するテーブル。ユーザーまたは組織に紐付く。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | YES | NULL | ユーザー ID（外部キー・一意）※1 |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー・一意）※1 |
| `externalId` | VARCHAR(255) | YES | NULL | 決済サービスのサブスクリプション ID（一意） |
| `plan` | ENUM | NO | FREE | プラン種別（SubscriptionPlan） |
| `status` | ENUM | NO | ACTIVE | ステータス |
| `billingCycle` | ENUM | NO | MONTHLY | 請求サイクル（MONTHLY, YEARLY） |
| `currentPeriodStart` | TIMESTAMP | NO | - | 現在の請求期間開始日 |
| `currentPeriodEnd` | TIMESTAMP | NO | - | 現在の請求期間終了日 |
| `cancelAtPeriodEnd` | BOOLEAN | NO | false | 期間終了時にキャンセル |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `userId` と `organizationId` はどちらか一方のみ設定（排他制約）。また、各ユーザー/組織につき1つのサブスクリプションのみ許可（一意制約）。

### サブスクリプションステータス

| ステータス | 説明 |
|------------|------|
| `ACTIVE` | アクティブ（有効） |
| `PAST_DUE` | 支払い遅延 |
| `CANCELED` | キャンセル済み |
| `TRIALING` | トライアル中 |

### 請求サイクル

| サイクル | 説明 |
|----------|------|
| `MONTHLY` | 月払い |
| `YEARLY` | 年払い（2ヶ月分無料） |

### プラン種別

| プラン | 説明 |
|--------|------|
| `FREE` | 無料プラン（個人） |
| `PRO` | 有料プラン（個人） |
| `TEAM` | チームプラン（組織） |
| `ENTERPRISE` | エンタープライズプラン（組織） |

### 制約

- `userId` か `organizationId` のどちらか一方が必ず設定される（排他制約）
- `userId` は一意（1ユーザーにつき1サブスクリプション）
- `organizationId` は一意（1組織につき1サブスクリプション）
- `externalId` は一意

### Prisma スキーマ

```prisma
enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

enum BillingCycle {
  MONTHLY
  YEARLY
}

enum SubscriptionPlan {
  FREE
  PRO
  TEAM
  ENTERPRISE
}

model Subscription {
  id                 String             @id @default(uuid())
  userId             String?            @unique @map("user_id")
  organizationId     String?            @unique @map("organization_id")
  externalId         String?            @unique @map("external_id") @db.VarChar(255)
  plan               SubscriptionPlan   @default(FREE)
  status             SubscriptionStatus @default(ACTIVE)
  billingCycle       BillingCycle       @default(MONTHLY) @map("billing_cycle")
  currentPeriodStart DateTime           @map("current_period_start")
  currentPeriodEnd   DateTime           @map("current_period_end")
  cancelAtPeriodEnd  Boolean            @default(false) @map("cancel_at_period_end")
  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  user         User?         @relation("UserSubscription", fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation("OrgSubscription", fields: [organizationId], references: [id], onDelete: Cascade)
  invoices     Invoice[]

  @@index([status])
  @@map("subscriptions")
}
```

### 排他制約（SQL）

```sql
-- userId か organizationId のどちらか一方のみ設定
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscription_owner_check"
  CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  );
```

---

## Invoice

請求書を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `subscriptionId` | UUID | NO | - | サブスクリプション ID（外部キー） |
| `invoiceNumber` | VARCHAR(50) | NO | - | 請求書番号（一意） |
| `amount` | DECIMAL(10,2) | NO | - | 請求金額 |
| `currency` | VARCHAR(3) | NO | JPY | 通貨コード |
| `status` | ENUM | NO | PENDING | 請求書ステータス |
| `periodStart` | TIMESTAMP | NO | - | 請求期間開始日 |
| `periodEnd` | TIMESTAMP | NO | - | 請求期間終了日 |
| `dueDate` | TIMESTAMP | NO | - | 支払期限 |
| `pdfUrl` | TEXT | YES | NULL | PDF ダウンロード URL |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 請求書ステータス

| ステータス | 説明 |
|------------|------|
| `PENDING` | 支払い待ち |
| `PAID` | 支払い済み |
| `FAILED` | 支払い失敗 |
| `VOID` | 無効 |

### 制約

- `invoiceNumber` は一意

### Prisma スキーマ

```prisma
enum InvoiceStatus {
  PENDING
  PAID
  FAILED
  VOID
}

model Invoice {
  id             String        @id @default(uuid())
  subscriptionId String        @map("subscription_id")
  invoiceNumber  String        @unique @map("invoice_number") @db.VarChar(50)
  amount         Decimal       @db.Decimal(10, 2)
  currency       String        @default("JPY") @db.VarChar(3)
  status         InvoiceStatus @default(PENDING)
  periodStart    DateTime      @map("period_start")
  periodEnd      DateTime      @map("period_end")
  dueDate        DateTime      @map("due_date")
  pdfUrl         String?       @map("pdf_url")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@index([status])
  @@map("invoices")
}
```

---

## PaymentMethod

支払い方法を管理するテーブル。クレジットカード情報はトークン化して保存。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | YES | NULL | ユーザー ID（外部キー）※1 |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー）※1 |
| `type` | ENUM | NO | CARD | 支払い方法タイプ |
| `externalId` | VARCHAR(255) | NO | - | 外部決済サービスの ID |
| `brand` | VARCHAR(50) | YES | NULL | カードブランド（visa, mastercard 等） |
| `last4` | VARCHAR(4) | YES | NULL | カード番号下4桁 |
| `expiryMonth` | INTEGER | YES | NULL | 有効期限（月） |
| `expiryYear` | INTEGER | YES | NULL | 有効期限（年） |
| `isDefault` | BOOLEAN | NO | false | デフォルトの支払い方法 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `userId` と `organizationId` はどちらか一方のみ設定（排他制約）

### 支払い方法タイプ

| タイプ | 説明 |
|--------|------|
| `CARD` | クレジットカード（デフォルト） |

### 制約

- `userId` か `organizationId` のどちらか一方が必ず設定される（排他制約）

### Prisma スキーマ

```prisma
enum PaymentMethodType {
  CARD
}

model PaymentMethod {
  id             String            @id @default(uuid())
  userId         String?           @map("user_id")
  organizationId String?           @map("organization_id")
  type           PaymentMethodType @default(CARD)
  externalId     String            @map("external_id") @db.VarChar(255)
  brand          String?           @db.VarChar(50)
  last4          String?           @db.VarChar(4)
  expiryMonth    Int?              @map("expiry_month")
  expiryYear     Int?              @map("expiry_year")
  isDefault      Boolean           @default(false) @map("is_default")
  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt @map("updated_at")

  user         User?         @relation("UserPaymentMethods", fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation("OrgPaymentMethods", fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
  @@map("payment_methods")
}
```

### 排他制約（SQL）

```sql
-- userId か organizationId のどちらか一方のみ設定
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_method_owner_check"
  CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  );
```

---

## PaymentEvent

Stripe Webhookイベントの冪等性確保と監査ログを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `externalId` | VARCHAR(255) | NO | - | Stripeイベント ID（一意） |
| `eventType` | VARCHAR(100) | NO | - | イベントタイプ |
| `payload` | JSON | NO | - | イベントペイロード |
| `status` | ENUM | NO | PENDING | 処理ステータス |
| `processedAt` | TIMESTAMP | YES | NULL | 処理完了日時 |
| `errorMessage` | TEXT | YES | NULL | エラーメッセージ |
| `retryCount` | INTEGER | NO | 0 | リトライ回数 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### PaymentEventステータス

| ステータス | 説明 |
|------------|------|
| `PENDING` | 処理待ち |
| `PROCESSED` | 処理完了 |
| `FAILED` | 処理失敗 |

### インデックス

- `status` - 処理待ちイベント検索用
- `eventType` - イベントタイプ別検索用
- `createdAt` - 古いイベント削除用

### Prisma スキーマ

```prisma
enum PaymentEventStatus {
  PENDING
  PROCESSED
  FAILED
}

model PaymentEvent {
  id           String             @id @default(uuid())
  externalId   String             @unique @map("external_id") @db.VarChar(255)
  eventType    String             @map("event_type") @db.VarChar(100)
  payload      Json
  status       PaymentEventStatus @default(PENDING)
  processedAt  DateTime?          @map("processed_at")
  errorMessage String?            @map("error_message") @db.Text
  retryCount   Int                @default(0) @map("retry_count")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt @map("updated_at")

  @@index([status])
  @@index([eventType])
  @@index([createdAt])
  @@map("payment_events")
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| BIL-001 | プランアップグレード | 上位プランへの変更（即時適用） |
| BIL-002 | プランダウングレード | 下位プランへの変更（次回更新時適用） |
| BIL-003 | 支払い方法登録 | クレジットカードの登録 |
| BIL-004 | 支払い方法変更 | 登録済みクレジットカードの変更 |
| BIL-005 | 請求履歴 | 過去の請求一覧を表示 |
| BIL-006 | 請求書ダウンロード | PDF 形式で請求書をダウンロード |
| BIL-007 | 年払いオプション | 年払い選択で2ヶ月分無料（全有料プラン対象） |
| BIL-008 | 使用量表示 | 現在の MCP セッション使用量を表示 |
| BIL-009 | 使用量アラート | MCP セッションが月間制限の 80% に達した際のメール通知 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連](./auth.md)
- [組織・プロジェクト](./organization.md)
- [使用量記録](./usage.md)
- [課金機能設計](../features/billing.md)
- [課金 API](../../api/billing.md)
