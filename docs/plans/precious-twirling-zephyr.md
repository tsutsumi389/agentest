# Phase 11: 課金・サブスクリプション 仕様書

## 概要

テスト管理ツールSaaSの有料プランと支払い機能を構築する。

### 設計前提
- **決済サービス**: 未定（Stripe/PAY.JP等を抽象化するインターフェースを設計）
- **通貨**: JPY（日本円）のみ
- **トライアル**: なし（FREEプランで基本機能を提供）

### プラン体系
| プラン | 対象 | 月額 | MCP上限 | 同時接続 |
|--------|------|------|---------|----------|
| FREE | 個人 | ¥0 | 100/月 | 1 |
| PRO | 個人 | ¥1,000 | 1,000/月 | 3 |
| TEAM | 組織 | ¥600/ユーザー(最低10名) | 5,000×ユーザー数/月 | 5×ユーザー数 |
| ENTERPRISE | 組織 | 要問合せ | 無制限 | 無制限 |

---

## 1. 機能要件

### 1.1 USR-007: 個人プラン選択

**概要**: 個人ユーザーがFREE/PROプランを選択・変更

**ユースケース**:
| シナリオ | フロー |
|----------|--------|
| FREE→PROアップグレード（支払い方法未登録） | プラン選択 → 支払い方法登録 → 請求サイクル選択 → 即時アップグレード |
| FREE→PROアップグレード（支払い方法登録済） | プラン選択 → 請求サイクル選択 → 即時アップグレード |
| PRO→FREEダウングレード | プラン選択 → 警告表示 → 次回更新時にダウングレード予約 |

**ビジネスルール**:
- アップグレードは即時適用（日割り請求）
- ダウングレードは次回更新時に適用（`cancelAtPeriodEnd=true`）
- ダウングレード予約中はキャンセル可能

---

### 1.2 ORG-006: 組織プラン選択

**概要**: 組織オーナー/管理者がTEAM/ENTERPRISEプランを選択・変更

**ユースケース**:
| シナリオ | フロー |
|----------|--------|
| TEAM新規契約 | プラン選択 → 支払い方法登録 → 請求先メール設定 → 請求サイクル選択 → 契約開始 |
| TEAM→ENTERPRISE | 問い合わせフォーム → 営業経由契約 → 管理画面からプラン変更 |

**ビジネスルール**:
- TEAMプランの最低料金は10ユーザー分（月額¥6,000〜）
- ENTERPRISEプランは営業経由での契約（API直接変更不可）
- 組織プラン変更は組織のOWNER/ADMINのみ実行可能

---

### 1.3 BIL-001: プランアップグレード

**概要**: 下位プランから上位プランへの即時変更

**処理フロー**:
1. 現在のプラン/期間を確認
2. 残り日数を計算
3. 日割り差額を計算
4. 即座に新プランを適用
5. 差額請求のInvoiceを作成
6. UsageRecordのmcpSessionLimitを新プラン値に更新
7. 監査ログを記録・通知送信

**日割り計算ロジック**:
```
残り日数 = currentPeriodEnd - 今日
日割り係数 = 残り日数 / 30

旧プラン日割り返金 = 旧プラン月額 × 日割り係数
新プラン日割り請求 = 新プラン月額 × 日割り係数
差額 = 新プラン日割り請求 - 旧プラン日割り返金

差額 > 0: 差額を請求
差額 <= 0: 次回請求から差額を控除
```

---

### 1.4 BIL-002: プランダウングレード

**概要**: 上位プランから下位プランへの変更（次回更新時適用）

**処理**:
- ダウングレード予約時: `cancelAtPeriodEnd = true`、`scheduledPlan`に次回プラン保存
- 期間終了時のバッチ処理でプラン変更を実行
- ダウングレード予約中でもキャンセル可能
- ダウングレード後に使用量が上限超過時はMCP新規セッション不可

---

### 1.5 BIL-003: 支払い方法登録（クレジットカード）

**フロー**:
1. フロントエンドで決済サービスのトークン化UIを表示
2. カード情報入力（番号、有効期限、CVC）
3. 決済サービス側でトークン化（PCI DSS対応）
4. トークンをバックエンドに送信
5. PaymentMethodレコードを作成（externalId、brand、last4、expiry）
6. 初回登録時は`isDefault=true`に設定

**セキュリティ**:
- カード番号は一切サーバーに送信しない（トークン化必須）
- last4のみ保存（マスク表示用）
- CVCは保存しない

---

### 1.6 BIL-004: 支払い方法変更

- 複数カード登録可能
- デフォルトカードは1つのみ
- 有効なサブスクリプションがある場合、最低1つのカードが必要
- カード削除時、サブスクリプションがあれば他のカードをデフォルトに設定

---

### 1.7 BIL-005: 請求履歴表示

**表示項目**:
- 請求書番号、請求金額、請求期間
- ステータス（PENDING/PAID/FAILED/VOID）
- 発行日、支払期限
- PDFダウンロードリンク

**機能**:
- ステータスでフィルタ
- 発行日でソート（降順デフォルト）
- ページネーション（20件/ページ）

---

### 1.8 BIL-006: PDF請求書ダウンロード

- PDFは決済サービス側で生成
- `pdfUrl`に署名付きURLを保存（有効期限付き）
- ダウンロード時に有効期限を確認、期限切れなら再取得

---

### 1.9 BIL-007: 年払いオプション

**計算式**:
```
年額 = 月額 × 10ヶ月（2ヶ月分無料）

例:
- PRO: ¥1,000/月 → ¥10,000/年（¥2,000お得）
- TEAM: ¥6,000/月(10名) → ¥60,000/年（¥12,000お得）
```

**変更ルール**:
- 月払い→年払い: 差額を請求して即時変更
- 年払い→月払い: 次回更新時に変更

---

### 1.10 BIL-008: MCP使用量表示

**表示内容**:
- 現在の使用量 / 月間上限
- 使用率（%）、プログレスバー（80%超で警告色）
- 期間、リセット日

---

### 1.11 BIL-009: 80%到達時のメール通知

**トリガー条件**:
- `mcpSessions >= mcpSessionLimit × 0.8`
- `alertSentAt`がnull（まだ送信していない）
- `mcpSessionLimit > 0`（無制限でない）

**処理**:
1. UsageRecordの`alertSentAt`に現在時刻を設定
2. Notificationレコードを作成（type: USAGE_ALERT）
3. メール送信

---

### 1.12 ORG-007: 組織の請求先設定

- `Organization.billingEmail`に保存
- 請求関連のメール通知はこのアドレスに送信
- 未設定の場合、組織オーナーのメールアドレスにフォールバック

---

## 2. データモデル設計

### 2.1 既存モデルへの追加属性

#### Subscription（追加）
| 属性 | 型 | 説明 |
|------|----|------|
| externalId | String? | 決済サービスのサブスクリプションID |
| scheduledPlan | SubscriptionPlan? | ダウングレード予約時の次回プラン |
| scheduledBillingCycle | BillingCycle? | 次回請求サイクル |
| canceledAt | DateTime? | キャンセル日時 |
| cancelReason | String? | キャンセル理由 |

#### Invoice（追加）
| 属性 | 型 | 説明 |
|------|----|------|
| externalId | String? | 決済サービスの請求書ID |
| description | String? | 請求内容説明 |
| subtotal | Decimal | 小計 |
| tax | Decimal | 税額 |
| discount | Decimal | 割引額 |
| paidAt | DateTime? | 支払い完了日時 |
| failedAt | DateTime? | 支払い失敗日時 |
| failureReason | String? | 失敗理由 |
| retryCount | Int | リトライ回数 |
| nextRetryAt | DateTime? | 次回リトライ日時 |

### 2.2 新規モデル: PlanPricing（価格マスタ）

| 属性 | 型 | 説明 |
|------|----|------|
| id | String | UUID |
| plan | SubscriptionPlan | プラン種別 |
| billingCycle | BillingCycle | 請求サイクル |
| currency | String | 通貨（JPY） |
| amount | Decimal | 金額 |
| perUser | Boolean | ユーザー単価かどうか |
| minUsers | Int? | 最小ユーザー数（TEAM用） |
| features | Json? | 機能リスト |
| isActive | Boolean | 有効フラグ |
| effectiveFrom | DateTime | 適用開始日 |
| effectiveTo | DateTime? | 適用終了日 |

### 2.3 新規モデル: PaymentEvent（決済イベント履歴）

| 属性 | 型 | 説明 |
|------|----|------|
| id | String | UUID |
| subscriptionId | String? | サブスクリプションID |
| invoiceId | String? | 請求書ID |
| eventType | String | イベントタイプ |
| externalEventId | String? | 決済サービスのイベントID（冪等性確保） |
| payload | Json | Webhookペイロード |
| processedAt | DateTime? | 処理完了日時 |
| errorMessage | String? | エラーメッセージ |

---

## 3. APIエンドポイント設計

### 3.1 個人向け

```
# サブスクリプション
GET    /api/users/me/subscription          # 現在のサブスクリプション取得
POST   /api/users/me/subscription          # 作成（FREEからアップグレード）
PUT    /api/users/me/subscription          # 変更
DELETE /api/users/me/subscription          # キャンセル（次回更新時）
POST   /api/users/me/subscription/reactivate  # キャンセル取消

# 支払い方法
GET    /api/users/me/payment-methods       # 一覧取得
POST   /api/users/me/payment-methods       # 追加
DELETE /api/users/me/payment-methods/:id   # 削除
PUT    /api/users/me/payment-methods/:id/default  # デフォルト変更

# 請求履歴
GET    /api/users/me/invoices              # 一覧取得
GET    /api/users/me/invoices/:id          # 詳細取得
GET    /api/users/me/invoices/:id/pdf      # PDFダウンロード

# 使用量
GET    /api/users/me/usage                 # 現在の使用量
GET    /api/users/me/usage/history         # 使用量履歴
```

### 3.2 組織向け

```
GET/POST/PUT/DELETE /api/organizations/:orgId/subscription
GET/POST/DELETE     /api/organizations/:orgId/payment-methods
GET                 /api/organizations/:orgId/invoices
GET                 /api/organizations/:orgId/usage
```

### 3.3 プラン情報・Webhook

```
GET  /api/plans                    # プラン一覧
GET  /api/plans/:plan/calculate    # プラン変更時の金額計算
POST /api/webhooks/payment         # 決済Webhook受信
```

---

## 4. 画面設計

### 4.1 個人設定 > プラン・課金タブ

**URL**: `/settings?tab=billing`

**構成**:
- **現在のプラン**: プラン名、金額、次回更新日、[プラン変更][解約]ボタン
- **MCP使用量**: 使用量/上限、プログレスバー、リセット日
- **支払い方法**: カード一覧（brand、last4、expiry）、[デフォルト][削除][追加]
- **請求履歴**: 請求書番号、金額、期間、状態、PDFダウンロード

### 4.2 プラン変更モーダル

- プラン選択（FREE/PRO）
- 請求サイクル選択（月額/年額）
- 日割り金額表示
- 次回更新日表示

### 4.3 組織設定 > 課金タブ

**URL**: `/organizations/:orgId/settings?tab=billing`

- 個人設定と同様の構成
- 追加: 請求先メール設定、ユーザー数に基づく金額表示

---

## 5. 外部決済連携の抽象化

### 5.1 PaymentGatewayインターフェース

```typescript
interface IPaymentGateway {
  // 顧客管理
  createCustomer(params): Promise<Customer>
  updateCustomer(customerId, params): Promise<Customer>
  deleteCustomer(customerId): Promise<void>

  // 支払い方法
  createPaymentMethod(customerId, token): Promise<PaymentMethodResult>
  deletePaymentMethod(paymentMethodId): Promise<void>
  setDefaultPaymentMethod(customerId, paymentMethodId): Promise<void>
  listPaymentMethods(customerId): Promise<PaymentMethodResult[]>

  // サブスクリプション
  createSubscription(params): Promise<SubscriptionResult>
  updateSubscription(subscriptionId, params): Promise<SubscriptionResult>
  cancelSubscription(subscriptionId, cancelAtPeriodEnd): Promise<SubscriptionResult>
  reactivateSubscription(subscriptionId): Promise<SubscriptionResult>

  // 請求書
  getInvoice(invoiceId): Promise<InvoiceResult>
  listInvoices(customerId, params): Promise<InvoiceResult[]>
  getInvoicePdf(invoiceId): Promise<string>  // 署名付きURL

  // Webhook
  verifyWebhookSignature(payload, signature): boolean
  parseWebhookEvent(payload): WebhookEvent

  // 日割り計算
  calculateProration(params): Promise<ProrationResult>
}
```

### 5.2 Webhook処理フロー

1. 決済サービスからPOST受信
2. 署名検証（無効なら400返却）
3. PaymentEvent作成（externalEventIdで冪等性チェック）
4. 200 OK即座に応答
5. 非同期でイベントタイプに応じた処理
   - `invoice.paid` → Invoice.status=PAID
   - `subscription.updated` → Subscription更新
   - `payment_intent.failed` → リトライ処理

---

## 6. セキュリティ要件

### 6.1 PCI DSS対応

| 要件 | 対応 |
|------|------|
| カード情報の非保持 | トークン化必須 |
| last4のみ保存 | 表示用 |
| CVCの非保存 | 決済時のみ使用 |
| 通信の暗号化 | TLS 1.2以上 |
| アクセスログ | 課金API全て監査ログ記録 |

### 6.2 認可ルール

| リソース | 個人 | 組織OWNER | 組織ADMIN | 組織MEMBER |
|----------|:----:|:---------:|:---------:|:----------:|
| 個人サブスクリプション | 本人のみ | - | - | - |
| 組織サブスクリプション参照 | - | ○ | ○ | - |
| 組織サブスクリプション変更 | - | ○ | ○ | - |
| 組織使用量参照 | - | ○ | ○ | ○ |

---

## 7. 運用要件

### 7.1 監査ログ記録対象

| アクション | 記録内容 |
|------------|----------|
| subscription.created | plan, billingCycle, amount |
| subscription.upgraded | previousPlan, newPlan, prorationAmount |
| subscription.downgrade_scheduled | currentPlan, scheduledPlan, effectiveDate |
| subscription.canceled | plan, effectiveDate, reason |
| payment_method.added/removed | brand, last4 |
| invoice.paid/failed | invoiceNumber, amount, reason |

### 7.2 決済失敗時のリトライ

```
リトライスケジュール:
- 1回目: 即時
- 2回目: 1日後
- 3回目: 3日後
- 4回目: 7日後（最終）

最終失敗後:
- status = 'PAST_DUE'
- 7日後: サービス制限（MCP接続不可）
- 14日後: サブスクリプション自動キャンセル
```

### 7.3 定期バッチ処理

| バッチ | タイミング | 処理 |
|--------|-----------|------|
| SubscriptionRenewal | 毎日 0:00 | 期間終了サブスクリプションの更新 |
| DowngradeApply | 毎日 0:00 | ダウングレード予約の適用 |
| UsageRecordCreate | 毎月1日 | 新規UsageRecord作成 |
| PaymentRetry | 毎日 6:00 | 失敗支払いのリトライ |
| WebhookRetry | 毎時 | 未処理Webhookの再処理 |

---

## 8. 実装優先順位

### Phase 11-A（MVP）
1. PlanPricingマスタ設計・初期データ
2. PaymentGatewayインターフェース設計
3. サブスクリプションCRUD API
4. 支払い方法登録API
5. 個人設定画面（プラン・課金タブ）

### Phase 11-B
1. アップグレード/ダウングレード処理
2. 日割り計算
3. 請求履歴表示
4. Webhook処理

### Phase 11-C
1. PDF請求書生成
2. 使用量表示
3. 80%通知
4. 組織向け課金画面

### Phase 11-D
1. 年払いオプション
2. 定期バッチ処理
3. リトライ処理
4. 監視・アラート

---

## 9. 重要ファイル

| ファイル | 変更内容 |
|----------|----------|
| `packages/db/prisma/schema.prisma` | Subscription、Invoice拡張、PlanPricing、PaymentEvent追加 |
| `apps/api/src/services/billing/` | BillingService、SubscriptionService、ProrationService新規作成 |
| `packages/shared/src/interfaces/payment-gateway.ts` | IPaymentGatewayインターフェース定義 |
| `apps/web/src/pages/Settings.tsx` | 「プラン・課金」タブ追加 |
| `apps/web/src/pages/OrganizationSettings.tsx` | 「課金」タブ追加 |
