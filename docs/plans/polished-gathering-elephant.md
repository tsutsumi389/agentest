# Phase 12: 通知機能 実装計画

## 概要

アプリ内通知（WebSocketリアルタイム配信）とメール通知機能を実装する。

**要件:**
- アプリ内通知: WebSocketによるリアルタイム通知
- メール通知: dev環境では仮想送信（コンソール出力のみ）

---

## 現状

| 項目 | 状態 |
|------|------|
| DBスキーマ | ✅ 定義済み（Notification, NotificationPreference, OrganizationNotificationSetting） |
| WebSocket基盤 | ✅ 運用中（apps/ws/、Redis Pub/Sub、`user:{userId}`チャンネル） |
| 通知サービス | ❌ 未実装 |
| メール送信 | ❌ 未実装 |
| フロントエンドUI | ❌ 未実装 |

---

## 実装ステップ

### Step 1: バックエンド基盤

#### 1.1 NotificationRepository
**ファイル:** `apps/api/src/repositories/notification.repository.ts`

```typescript
// 主要メソッド
create(data): Promise<Notification>
findByUserId(userId, { limit, offset, unreadOnly }): Promise<Notification[]>
countUnread(userId): Promise<number>
markAsRead(id): Promise<Notification>
markAllAsRead(userId): Promise<number>
delete(id): Promise<void>
getPreferences(userId): Promise<NotificationPreference[]>
upsertPreference(userId, type, data): Promise<NotificationPreference>
```

#### 1.2 NotificationService
**ファイル:** `apps/api/src/services/notification.service.ts`

```typescript
// コア機能
async send(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  organizationId?: string;
}): Promise<void> {
  // 1. ユーザー設定チェック
  // 2. 組織設定チェック（該当時）
  // 3. inAppEnabled → DB保存 + WebSocket送信
  // 4. emailEnabled → メール送信
}
```

#### 1.3 NotificationController & Routes
**ファイル:**
- `apps/api/src/controllers/notification.controller.ts`
- `apps/api/src/routes/notifications.ts`

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/notifications` | GET | 通知一覧取得 |
| `/api/notifications/unread-count` | GET | 未読数取得 |
| `/api/notifications/:id/read` | PATCH | 既読にする |
| `/api/notifications/mark-all-read` | POST | 全て既読 |
| `/api/notifications/:id` | DELETE | 削除 |
| `/api/notifications/preferences` | GET | 設定取得 |
| `/api/notifications/preferences/:type` | PATCH | 設定更新 |

#### 1.4 ルート登録
**ファイル:** `apps/api/src/routes/index.ts`
```typescript
import notificationRoutes from './notifications.js';
router.use('/api/notifications', notificationRoutes);
```

---

### Step 2: WebSocket通知イベント型

**ファイル:** `packages/ws-types/src/events.ts`

```typescript
// 追加するイベント型
export interface NotificationReceivedEvent extends BaseEvent {
  type: 'notification:received';
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    createdAt: string;
  };
}

export interface NotificationReadEvent extends BaseEvent {
  type: 'notification:read';
  notificationId: string;
}

export interface NotificationUnreadCountEvent extends BaseEvent {
  type: 'notification:unread_count';
  count: number;
}

export type NotificationEvent =
  | NotificationReceivedEvent
  | NotificationReadEvent
  | NotificationUnreadCountEvent;

// ServerEventに追加
export type ServerEvent =
  | ExecutionEvent
  | LockEvent
  // ...既存...
  | NotificationEvent;
```

---

### Step 3: メール送信基盤（Mailpit連携）

#### 3.1 Mailpitコンテナ追加
**ファイル:** `docker/docker-compose.override.yml`

```yaml
# Mailpit（開発・ステージング用メールサーバー）
mailpit:
  image: axllent/mailpit:latest
  container_name: agentest-mailpit
  restart: unless-stopped
  ports:
    - "${MAILPIT_WEB_PORT:-8025}:8025"   # Web UI
    - "${MAILPIT_SMTP_PORT:-1025}:1025"  # SMTP
  environment:
    MP_SMTP_AUTH_ACCEPT_ANY: 1
    MP_SMTP_AUTH_ALLOW_INSECURE: 1
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:8025/api/v1/info"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**Web UI:** http://localhost:8025 でメール確認可能

#### 3.2 環境変数
**ファイル:** `apps/api/src/config/env.ts`

```typescript
// SMTP設定
SMTP_HOST: z.string().default('mailpit'),       // dev/staging: mailpit
SMTP_PORT: z.coerce.number().default(1025),     // dev/staging: 1025
SMTP_USER: z.string().optional(),               // mailpitでは不要
SMTP_PASS: z.string().optional(),               // mailpitでは不要
SMTP_FROM: z.string().email().default('noreply@agentest.io'),
SMTP_SECURE: z.coerce.boolean().default(false), // 本番: true
```

**開発環境 `.env` 例:**
```env
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@agentest.local
```

**本番環境 `.env` 例:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
SMTP_FROM=noreply@agentest.io
SMTP_SECURE=false
```

#### 3.3 EmailService
**ファイル:** `apps/api/src/services/email.service.ts`

```typescript
import nodemailer from 'nodemailer';

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // 環境に応じた設定（dev/staging: Mailpit、本番: 実SMTP）
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      } : undefined,
    });
  }

  async send(params: SendEmailParams): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    // ログ出力（開発時のデバッグ用）
    if (env.NODE_ENV !== 'production') {
      console.log('📧 [EMAIL SENT]', {
        to: params.to,
        subject: params.subject,
        mailpitUrl: 'http://localhost:8025',
      });
    }
  }
}

export const emailService = new EmailService();
```

#### 3.3 メールテンプレート
**ディレクトリ:** `apps/api/src/templates/email/`

| ファイル | 通知タイプ |
|---------|-----------|
| `org-invitation.ts` | ORG_INVITATION |
| `invitation-accepted.ts` | INVITATION_ACCEPTED |
| `project-added.ts` | PROJECT_ADDED |
| `review-comment.ts` | REVIEW_COMMENT |
| `test-completed.ts` | TEST_COMPLETED |
| `test-failed.ts` | TEST_FAILED |
| `usage-alert.ts` | USAGE_ALERT |
| `billing.ts` | BILLING |
| `security-alert.ts` | SECURITY_ALERT |

---

### Step 4: フロントエンド実装

#### 4.1 通知ストア
**ファイル:** `apps/web/src/stores/notification.ts`

```typescript
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreference[];

  fetchNotifications(): Promise<void>;
  fetchUnreadCount(): Promise<void>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;

  // WebSocketハンドラ
  handleNotificationReceived(notification: Notification): void;
  handleUnreadCountUpdate(count: number): void;
}
```

#### 4.2 通知API
**ファイル:** `apps/web/src/lib/api.ts`（追加）

```typescript
export const notificationsApi = {
  list: (params?) => api.get('/api/notifications', params),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.post('/api/notifications/mark-all-read'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
  getPreferences: () => api.get('/api/notifications/preferences'),
  updatePreference: (type, settings) => api.patch(`/api/notifications/preferences/${type}`, settings),
};
```

#### 4.3 コンポーネント
**ディレクトリ:** `apps/web/src/components/notification/`

| ファイル | 説明 |
|---------|------|
| `NotificationCenter.tsx` | ヘッダーの通知ベル + ドロップダウン |
| `NotificationItem.tsx` | 個別通知の表示 |
| `NotificationList.tsx` | 通知一覧 |
| `NotificationPreferenceForm.tsx` | 設定フォーム |

#### 4.4 ページ
| ファイル | パス | 説明 |
|---------|------|------|
| `pages/Notifications.tsx` | `/notifications` | 通知一覧ページ |
| `pages/settings/NotificationSettings.tsx` | `/settings/notifications` | 通知設定ページ |

#### 4.5 Headerへの組み込み
**ファイル:** `apps/web/src/components/layout-parts/Header.tsx`

```typescript
// NotificationCenterを追加
<NotificationCenter />
```

#### 4.6 useNotifications Hook
**ファイル:** `apps/web/src/hooks/useNotifications.ts`

```typescript
export function useNotifications() {
  const store = useNotificationStore();

  useEffect(() => {
    // WebSocket購読
    const unsub1 = wsClient.on('notification:received', (e) => {
      store.handleNotificationReceived(e.notification);
      toast.info(e.notification.title);  // トースト表示
    });
    const unsub2 = wsClient.on('notification:unread_count', (e) => {
      store.handleUnreadCountUpdate(e.count);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  return store;
}
```

---

### Step 5: 既存機能への通知トリガー実装

| 通知タイプ | トリガー箇所 | 変更ファイル |
|-----------|-------------|-------------|
| ORG_INVITATION | 組織招待時 | `services/organization.service.ts` |
| INVITATION_ACCEPTED | 招待承諾時 | `services/organization.service.ts` |
| PROJECT_ADDED | プロジェクトメンバー追加時 | `services/project.service.ts` |
| REVIEW_COMMENT | レビューコメント追加時 | `services/review.service.ts` |
| TEST_COMPLETED | テスト実行完了時 | `services/execution.service.ts` |
| TEST_FAILED | テスト実行失敗時 | `services/execution.service.ts` |

**例: 組織招待時の通知**
```typescript
// organization.service.ts の invite() に追加
await notificationService.send({
  userId: existingUser.id,
  type: 'ORG_INVITATION',
  title: `${organization.name}への招待`,
  body: `${inviter.name}さんから招待が届いています`,
  data: { organizationId, inviteToken },
  organizationId,
});
```

---

### Step 6: テスト

#### ユニットテスト
```
apps/api/src/__tests__/unit/
├── notification.repository.test.ts
├── notification.service.test.ts
└── email.service.test.ts
```

#### 統合テスト
```
apps/api/src/__tests__/integration/
├── notifications.integration.test.ts
└── notification-triggers.integration.test.ts
```

**テストケース:**
- 設定無効時は通知しない
- mockModeでメール送信しない（ログ出力のみ）
- WebSocket経由で通知が配信される
- 既読処理が正常動作する

---

## ファイル一覧

### 新規作成

**バックエンド**
```
apps/api/src/
├── repositories/notification.repository.ts
├── services/notification.service.ts
├── services/email.service.ts
├── controllers/notification.controller.ts
├── routes/notifications.ts
├── validators/notification.validator.ts
└── templates/email/
    ├── org-invitation.ts
    ├── invitation-accepted.ts
    ├── project-added.ts
    ├── review-comment.ts
    ├── test-completed.ts
    ├── test-failed.ts
    ├── usage-alert.ts
    ├── billing.ts
    └── security-alert.ts
```

**フロントエンド**
```
apps/web/src/
├── stores/notification.ts
├── hooks/useNotifications.ts
├── components/notification/
│   ├── NotificationCenter.tsx
│   ├── NotificationItem.tsx
│   ├── NotificationList.tsx
│   └── NotificationPreferenceForm.tsx
└── pages/
    ├── Notifications.tsx
    └── settings/NotificationSettings.tsx
```

**共通**
```
packages/ws-types/src/events.ts（更新）
```

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `docker/docker-compose.override.yml` | Mailpitコンテナ追加 |
| `.env.example` | SMTP環境変数追加 |
| `apps/api/src/config/env.ts` | SMTP環境変数追加 |
| `apps/api/src/routes/index.ts` | 通知ルート登録 |
| `apps/api/src/services/organization.service.ts` | 通知トリガー追加 |
| `apps/api/src/services/project.service.ts` | 通知トリガー追加 |
| `apps/api/src/services/review.service.ts` | 通知トリガー追加 |
| `apps/api/src/services/execution.service.ts` | 通知トリガー追加 |
| `packages/ws-types/src/events.ts` | NotificationEvent追加 |
| `apps/web/src/lib/api.ts` | notificationsApi追加 |
| `apps/web/src/components/layout-parts/Header.tsx` | NotificationCenter追加 |

---

## 検証方法

1. **バックエンドAPI確認**
   ```bash
   # 通知一覧取得
   curl -X GET http://localhost:3001/api/notifications -H "Cookie: ..."

   # 未読数取得
   curl -X GET http://localhost:3001/api/notifications/unread-count
   ```

2. **WebSocket通知確認**
   - ブラウザで2タブ開く
   - 片方で組織招待を実行
   - もう片方でリアルタイム通知が表示されることを確認

3. **メール送信確認（Mailpit）**
   - Mailpit Web UIを開く: http://localhost:8025
   - 組織招待などのメール通知トリガーを実行
   - Mailpit上でメールが受信されていることを確認
   - メールの内容、HTML表示を確認

4. **テスト実行**
   ```bash
   docker compose exec dev pnpm test
   ```

---

## 依存パッケージ

```bash
# バックエンド（apps/api）
pnpm add nodemailer
pnpm add -D @types/nodemailer
```
