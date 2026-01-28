# Phase 5: Webhook拡張 - 実装計画

## 概要

組織向けサブスクリプションのWebhook対応と、メンバー変更時の自動数量同期機能を追加する。

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/services/webhook.service.ts` | metadata型拡張、組織サブスクリプション対応 |
| `apps/api/src/services/organization.service.ts` | メンバー変更時のsyncMemberCount呼び出し |

---

## 1. webhook.service.ts の変更

### 1.1 metadata型の拡張 (行47-51)

```typescript
metadata: {
  plan?: string;
  billingCycle?: string;
  userId?: string;
  organizationId?: string;  // 追加
};
```

### 1.2 handleSubscriptionCreated の拡張 (行207-250)

**変更方針**: organizationIdがmetadataにある場合は`upsertForOrganization`を使用

```typescript
const userId = data.metadata.userId;
const organizationId = data.metadata.organizationId;

if (!userId && !organizationId) {
  logger.warn('Subscription created event has no userId or organizationId');
  return;
}

// ... 共通処理（period、plan、billingCycle取得）

if (organizationId) {
  await this.subscriptionRepo.upsertForOrganization(organizationId, subscriptionParams);
  logger.info('Organization subscription created via webhook', { organizationId });
} else if (userId) {
  await this.subscriptionRepo.upsertForUser(userId, subscriptionParams);
  logger.info('Subscription created via webhook', { userId });
}
```

### 1.3 handleSubscriptionDeleted の拡張 (行289-311)

**変更方針**: organizationIdがある場合はステータス更新のみ（プラン変更なし）

```typescript
// ユーザー向け: プランをFREEに更新
if (subscription.userId) {
  await this.userRepo.updatePlan(subscription.userId, 'FREE');
  logger.info('Subscription deleted via webhook (user)', { userId });
}
// 組織向け: ステータス更新のみ（CANCELEDステータスで制御）
else if (subscription.organizationId) {
  logger.info('Subscription deleted via webhook (organization)', { organizationId });
}
```

---

## 2. organization.service.ts の変更

### 2.1 依存注入の追加 (行10-11付近)

```typescript
import { OrganizationSubscriptionService } from './organization-subscription.service.js';
import { logger } from '../utils/logger.js';

export class OrganizationService {
  private orgRepo = new OrganizationRepository();
  private orgSubscriptionService = new OrganizationSubscriptionService();  // 追加
```

### 2.2 acceptInvitation への syncMemberCount 追加 (行316後)

```typescript
// トランザクション完了後
// メンバー数を Stripe と同期（エラーでも招待承諾は成功させる）
try {
  await this.orgSubscriptionService.syncMemberCount(invitation.organizationId);
} catch (error) {
  logger.warn('Failed to sync member count after invitation acceptance', {
    organizationId: invitation.organizationId,
    error: error instanceof Error ? error.message : String(error),
  });
}
```

### 2.3 removeMember への syncMemberCount 追加 (行433後)

```typescript
// メンバー削除後
// メンバー数を Stripe と同期（エラーでもメンバー削除は成功させる）
try {
  await this.orgSubscriptionService.syncMemberCount(organizationId);
} catch (error) {
  logger.warn('Failed to sync member count after member removal', {
    organizationId,
    error: error instanceof Error ? error.message : String(error),
  });
}
```

---

## 3. エラーハンドリング方針

| 場面 | 方針 |
|-----|------|
| Webhook処理でorganizationId/userIdなし | 警告ログ出力、早期リターン |
| syncMemberCount失敗 | 警告ログのみ、メイン処理は成功させる |
| 課金同期タイミング | 追加=即時課金、削除=次回更新時反映 |

---

## 4. 実装順序

1. webhook.service.ts の metadata型拡張
2. webhook.service.ts の handleSubscriptionCreated 拡張
3. webhook.service.ts の handleSubscriptionDeleted 拡張
4. organization.service.ts の依存注入追加
5. organization.service.ts の acceptInvitation 変更
6. organization.service.ts の removeMember 変更

---

## 5. 検証方法

1. **ユニットテスト実行**
   ```bash
   docker compose exec dev pnpm test
   ```

2. **Webhookテスト（Stripe CLI）**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   stripe trigger customer.subscription.created
   ```

3. **メンバー同期テスト**
   - 組織に招待を送信→承諾→Stripeのサブスクリプション数量が+1されることを確認
   - メンバーを削除→Stripeのサブスクリプション数量が-1されることを確認

4. **エラーハンドリング確認**
   - サブスクリプションがない組織でメンバー追加→エラーなく完了することを確認
