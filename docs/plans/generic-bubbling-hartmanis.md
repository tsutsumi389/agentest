# E2Eテストシナリオ拡充計画（Phase 2）

## 概要

Phase 1（基本CRUD・実行・ロック）完了後、Web設定系機能をカバーする。
**目標**: テストケース数 59 → 104 へ拡充（+45テスト）

## 現状（Phase 1完了）

```
e2e/tests/web/
├── login.spec.ts           # 認証（3個）
├── dashboard.spec.ts       # ダッシュボード（4個）
├── projects.spec.ts        # プロジェクト（6個）
├── test-suites.spec.ts     # テストスイート（5個）
├── test-cases.spec.ts      # テストケースCRUD
├── test-case-details.spec.ts # 前提条件・ステップ・期待結果
├── executions.spec.ts      # テスト実行
└── edit-locks.spec.ts      # 編集ロック
```

## Phase 2で追加するテスト（Web設定系）

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `user-settings.spec.ts` | 12 | プロフィール・セキュリティ・APIトークン |
| `project-settings.spec.ts` | 10 | 環境管理・ラベル・削除済み復元 |
| `organizations.spec.ts` | 15 | 組織CRUD・メンバー管理・招待 |
| `notifications.spec.ts` | 8 | 通知一覧・設定・既読管理 |

**合計: 45テスト追加**

---

## 詳細テストケース

### 1. user-settings.spec.ts（12テスト）

```typescript
test.describe('プロフィール設定', () => {
  test('プロフィール情報が表示される');
  test('表示名を変更できる');
  test('プロフィール画像をアップロードできる');
});

test.describe('セキュリティ設定', () => {
  test('パスワードを変更できる');
  test('2FAを有効化できる');
  test('ログインセッション一覧が表示される');
  test('セッションを削除できる');
});

test.describe('APIトークン管理', () => {
  test('APIトークンを作成できる');
  test('APIトークン一覧が表示される');
  test('APIトークンを削除できる');
});

test.describe('課金設定', () => {
  test('現在のプランが表示される');
  test('請求履歴が表示される');
});
```

### 2. project-settings.spec.ts（10テスト）

```typescript
test.describe('プロジェクト一般設定', () => {
  test('プロジェクト名を変更できる');
  test('プロジェクト説明を変更できる');
});

test.describe('環境管理', () => {
  test('テスト環境を作成できる');
  test('テスト環境を編集できる');
  test('テスト環境を削除できる');
});

test.describe('ラベル管理', () => {
  test('ラベルを作成できる');
  test('ラベルを編集できる');
  test('ラベルを削除できる');
});

test.describe('削除済みテストスイート', () => {
  test('削除済みスイート一覧が表示される');
  test('削除済みスイートを復元できる');
});
```

### 3. organizations.spec.ts（15テスト）

```typescript
test.describe('組織一覧', () => {
  test('所属組織一覧が表示される');
  test('新規組織を作成できる');
});

test.describe('組織設定', () => {
  test('組織名を変更できる');
  test('組織ロゴをアップロードできる');
});

test.describe('メンバー管理', () => {
  test('メンバー一覧が表示される');
  test('メンバーの役割を変更できる');
  test('メンバーを削除できる');
});

test.describe('招待管理', () => {
  test('メンバーを招待できる');
  test('保留中の招待一覧が表示される');
  test('招待を再送信できる');
  test('招待をキャンセルできる');
});

test.describe('監査ログ', () => {
  test('組織の監査ログが表示される');
});

test.describe('危険な操作', () => {
  test('組織を削除できる');
  test('確認ダイアログが表示される');
});
```

### 4. notifications.spec.ts（8テスト）

```typescript
test.describe('通知一覧', () => {
  test('通知一覧が表示される');
  test('通知をクリックで既読にできる');
  test('すべてを既読にできる');
  test('通知をスクロールで追加読み込みできる');
});

test.describe('通知設定', () => {
  test('通知設定ページが表示される');
  test('通知タイプごとにON/OFFできる');
  test('メール通知設定を変更できる');
  test('設定を保存できる');
});
```

---

## 実装順序

```
1. user-settings.spec.ts     # プロフィール・セキュリティ・API
2. project-settings.spec.ts  # 環境・ラベル・復元
3. organizations.spec.ts     # 組織CRUD・メンバー・招待
4. notifications.spec.ts     # 通知一覧・設定
```

---

## 必要なインフラ準備

### APIクライアント拡張（e2e/helpers/api-client.ts）

```typescript
// 組織管理
createOrganization(data)
deleteOrganization(organizationId)
inviteMember(organizationId, data)
cancelInvitation(organizationId, invitationId)
updateMemberRole(organizationId, memberId, role)
removeMember(organizationId, memberId)

// ユーザー設定
updateUserProfile(data)
createApiToken(data)
deleteApiToken(tokenId)

// プロジェクト設定
createEnvironment(projectId, data)
updateEnvironment(projectId, environmentId, data)
deleteEnvironment(projectId, environmentId)
createLabel(projectId, data)
updateLabel(projectId, labelId, data)
deleteLabel(projectId, labelId)
restoreTestSuite(projectId, testSuiteId)

// 通知
getNotifications(params)
markAsRead(notificationId)
markAllAsRead()
updateNotificationSettings(data)
```

---

## ディレクトリ構成（Phase 2完了後）

```
e2e/tests/web/
├── login.spec.ts
├── dashboard.spec.ts
├── projects.spec.ts
├── test-suites.spec.ts
├── test-cases.spec.ts
├── test-case-details.spec.ts
├── executions.spec.ts
├── edit-locks.spec.ts
├── user-settings.spec.ts      # NEW
├── project-settings.spec.ts   # NEW
├── organizations.spec.ts      # NEW
└── notifications.spec.ts      # NEW
```

---

## 期待される成果

| 指標 | Phase 1完了 | Phase 2完了 |
|------|------------|------------|
| テストファイル数 | 8 | 12 |
| テストケース数 | 59 | 104 |
| Web機能カバレッジ | 40% | 70% |

---

## 検証方法

```bash
# 全テスト実行
cd e2e && pnpm test

# 特定ファイル
pnpm test tests/web/user-settings.spec.ts

# UIモードでデバッグ
pnpm test:ui
```
