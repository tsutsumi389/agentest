# 課金・サブスクリプション テーブル

## 概要

ユーザー/組織のサブスクリプション管理、請求書、支払い方法を管理するテーブル。

## Subscription

サブスクリプション情報を管理するテーブル。ユーザーまたは組織に紐付く。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | YES | NULL | ユーザー ID（外部キー）※1 |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー）※1 |
| `plan` | ENUM | NO | - | プラン種別（SubscriptionPlan） |
| `status` | ENUM | NO | ACTIVE | ステータス |
| `billingCycle` | ENUM | NO | MONTHLY | 請求サイクル（MONTHLY, YEARLY） |
| `currentPeriodStart` | TIMESTAMP | NO | - | 現在の請求期間開始日 |
| `currentPeriodEnd` | TIMESTAMP | NO | - | 現在の請求期間終了日 |
| `cancelAtPeriodEnd` | BOOLEAN | NO | false | 期間終了時にキャンセル |
| `canceledAt` | TIMESTAMP | YES | NULL | キャンセル日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `userId` と `organizationId` はどちらか一方のみ設定（排他制約）

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
  id                 String             @id @default(uuid()) @db.Uuid
  userId             String?            @db.Uuid
  organizationId     String?            @db.Uuid
  plan               SubscriptionPlan
  status             SubscriptionStatus @default(ACTIVE)
  billingCycle       BillingCycle       @default(MONTHLY)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean            @default(false)
  canceledAt         DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invoices     Invoice[]

  @@index([userId])
  @@index([organizationId])
  @@index([status])
}
```

### 排他制約（SQL）

```sql
-- userId か organizationId のどちらか一方のみ設定
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_owner_check"
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
| `currency` | VARCHAR(3) | NO | USD | 通貨コード |
| `status` | ENUM | NO | PENDING | 請求書ステータス |
| `periodStart` | TIMESTAMP | NO | - | 請求期間開始日 |
| `periodEnd` | TIMESTAMP | NO | - | 請求期間終了日 |
| `paidAt` | TIMESTAMP | YES | NULL | 支払い日時 |
| `dueDate` | TIMESTAMP | NO | - | 支払期限 |
| `pdfUrl` | TEXT | YES | NULL | PDF ダウンロード URL |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

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
  id             String        @id @default(uuid()) @db.Uuid
  subscriptionId String        @db.Uuid
  invoiceNumber  String        @unique @db.VarChar(50)
  amount         Decimal       @db.Decimal(10, 2)
  currency       String        @default("USD") @db.VarChar(3)
  status         InvoiceStatus @default(PENDING)
  periodStart    DateTime
  periodEnd      DateTime
  paidAt         DateTime?
  dueDate        DateTime
  pdfUrl         String?
  createdAt      DateTime      @default(now())

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@index([status])
  @@index([invoiceNumber])
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
| `type` | ENUM | NO | - | 支払い方法タイプ |
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
| `CARD` | クレジットカード |

### 制約

- `userId` か `organizationId` のどちらか一方が必ず設定される（排他制約）

### Prisma スキーマ

```prisma
enum PaymentMethodType {
  CARD
}

model PaymentMethod {
  id             String            @id @default(uuid()) @db.Uuid
  userId         String?           @db.Uuid
  organizationId String?           @db.Uuid
  type           PaymentMethodType
  externalId     String            @db.VarChar(255)
  brand          String?           @db.VarChar(50)
  last4          String?           @db.VarChar(4)
  expiryMonth    Int?
  expiryYear     Int?
  isDefault      Boolean           @default(false)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
}
```

### 排他制約（SQL）

```sql
-- userId か organizationId のどちらか一方のみ設定
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "payment_method_owner_check"
  CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  );
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
