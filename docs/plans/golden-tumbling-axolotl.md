# Phase 12: 通知機能 ドキュメント更新計画

## 概要

通知機能（`docs/plans/polished-gathering-elephant.md`）の実装完了に伴い、関連ドキュメントを更新する。

---

## 更新対象ファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| `docs/architecture/features/notification.md` | 新規作成 | 通知機能の全体仕様書 |
| `docs/api/notifications.md` | 新規作成 | 通知API仕様書 |
| `docs/api/README.md` | 更新 | エンドポイント一覧に通知API追加 |
| `docs/architecture/features/README.md` | 更新 | 機能一覧で通知を「作成済み」に変更 |
| `docs/architecture/overview.md` | 更新 | 通知フロー・Mailpit情報追加 |
| `docs/guides/development.md` | 更新 | Mailpit設定・SMTP環境変数追加 |

---

## 1. docs/architecture/features/notification.md（新規作成）

他の機能仕様書（authentication.md等）に準拠した構成で作成:

```markdown
# 通知機能

## 概要
アプリ内通知（WebSocketリアルタイム配信）とメール通知を提供

## 機能一覧
- 通知一覧表示・ページネーション
- 未読数バッジ・既読処理
- 通知設定（タイプ別 メール/アプリ内 ON/OFF）
- WebSocketリアルタイム配信
- メール送信（dev: Mailpit、本番: SMTP）

## 画面仕様
- NotificationCenter（ヘッダーのベル）
- Notifications ページ（/notifications）
- NotificationSettings ページ（/settings/notifications）※未実装

## 業務フロー
- 通知送信フロー（設定チェック→DB保存→WebSocket→メール）
- 優先順位: 組織設定 > ユーザー設定 > デフォルト

## データモデル
- Notification, NotificationPreference, OrganizationNotificationSetting

## 通知タイプ
ORG_INVITATION, INVITATION_ACCEPTED, PROJECT_ADDED, REVIEW_COMMENT,
TEST_COMPLETED, TEST_FAILED, USAGE_ALERT, BILLING, SECURITY_ALERT
```

---

## 2. docs/api/notifications.md（新規作成）

### エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/notifications` | 通知一覧取得 |
| GET | `/api/notifications/unread-count` | 未読数取得 |
| PATCH | `/api/notifications/:id/read` | 既読にする |
| POST | `/api/notifications/mark-all-read` | 全て既読 |
| DELETE | `/api/notifications/:id` | 削除 |
| GET | `/api/notifications/preferences` | 設定取得 |
| PATCH | `/api/notifications/preferences/:type` | 設定更新 |

### リクエスト/レスポンス例

各エンドポイントのパラメータ、レスポンス形式を記載

---

## 3. docs/api/README.md（更新）

「編集ロック」セクションの後に以下を追加:

```markdown
### 通知

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/notifications` | 通知一覧取得 |
| GET | `/notifications/unread-count` | 未読数取得 |
| PATCH | `/notifications/:id/read` | 既読にする |
| POST | `/notifications/mark-all-read` | 全て既読 |
| DELETE | `/notifications/:id` | 削除 |
| GET | `/notifications/preferences` | 設定取得 |
| PATCH | `/notifications/preferences/:type` | 設定更新 |

→ [通知 API 詳細](./notifications.md)
```

---

## 4. docs/architecture/features/README.md（更新）

「その他（予定）」セクションの通知行を「通知・課金」セクションに移動:

```markdown
### 通知・課金

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| 通知 | メール・アプリ内通知 | [notification.md](./notification.md) |
| 課金 | サブスクリプション、請求 | 未作成 |
```

---

## 5. docs/architecture/overview.md（更新）

### 5.1 packages/ws-types に通知イベントを追記

```diff
- | `packages/ws-types` | WebSocket イベント型 (`apps/ws` と連携) - ExecutionEvent, LockEvent, DashboardEvent, TestSuiteUpdatedEvent, TestCaseUpdatedEvent 等 |
+ | `packages/ws-types` | WebSocket イベント型 (`apps/ws` と連携) - ExecutionEvent, LockEvent, DashboardEvent, TestSuiteUpdatedEvent, TestCaseUpdatedEvent, NotificationEvent 等 |
```

### 5.2 通知フローを追加

「リアルタイム更新フロー」の後に「通知フロー」セクションを追加:

```markdown
### 通知フロー

```
イベント発生 → NotificationService →
  ├→ DB 保存 → Redis Pub/Sub → WebSocket → クライアント（リアルタイム表示）
  └→ メール送信（dev: Mailpit、本番: SMTP）
```

設定チェック優先順位: 組織設定 > ユーザー設定 > デフォルト（有効）
```

### 5.3 環境変数テーブルに SMTP 関連を追加

| 変数名 | 用途 | 設定例 |
|--------|------|--------|
| `SMTP_HOST` | メールサーバー | `mailpit`（dev）/ `smtp.sendgrid.net`（本番）|
| `SMTP_PORT` | SMTPポート | `1025`（dev）/ `587`（本番）|
| `SMTP_FROM` | 送信元アドレス | `noreply@agentest.io` |

---

## 6. docs/guides/development.md（更新）

### Mailpit セクションを追加

```markdown
## メール送信テスト（Mailpit）

開発環境ではMailpitを使用してメール送信をテストできます。

### アクセス
- Web UI: http://localhost:8025
- SMTP: localhost:1025

### 環境変数（apps/api）
```env
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@agentest.local
```

### 確認方法
1. 通知トリガー（組織招待など）を実行
2. http://localhost:8025 でメールを確認
```

---

## 検証方法

1. **リンク確認**: 各ドキュメント間のリンクが正しく機能すること
2. **整合性確認**: 実装コードと記載内容が一致すること
3. **フォーマット確認**: 既存ドキュメントと同じ構成・スタイル

---

## 実装済みコードの参照

| 種類 | パス |
|------|------|
| Repository | `apps/api/src/repositories/notification.repository.ts` |
| Service | `apps/api/src/services/notification.service.ts` |
| Email Service | `apps/api/src/services/email.service.ts` |
| Controller | `apps/api/src/controllers/notification.controller.ts` |
| Routes | `apps/api/src/routes/notifications.ts` |
| Store | `apps/web/src/stores/notification.ts` |
| Hook | `apps/web/src/hooks/useNotifications.ts` |
| Components | `apps/web/src/components/notification/` |
| WS Types | `packages/ws-types/src/events.ts` |
