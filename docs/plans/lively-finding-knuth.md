# 通知クリック時のナビゲーション機能 (TDD) ✅ 実装完了

## Context

組織への招待通知をクリックしても招待受け入れページ (`/invitations/:token`) に遷移せず、既読にするだけで終わる。
`NotificationItem` の `handleClick` にナビゲーションロジックが存在しないことが原因。

招待受け入れページ (`InvitationAccept.tsx`) と API (`POST /api/organizations/invitations/:token/accept`) は既に実装済みのため、通知クリック→ページ遷移の導線を追加する。

今回は招待通知だけでなく、全通知タイプのナビゲーション対応も行う。

## 方針

ナビゲーションロジックを純粋関数として `lib/notification-navigation.ts` に分離し、`NotificationItem` から呼び出す。

- 純粋関数のため React に依存せずユニットテスト可能
- `NotificationCenter.tsx` / `Notifications.tsx` は修正不要（NotificationItem 内部でナビゲーション実行）

## 通知タイプ別ナビゲーション先

| タイプ | data のキー | 遷移先 |
|--------|------------|--------|
| `ORG_INVITATION` | `inviteToken` | `/invitations/:inviteToken` |
| `INVITATION_ACCEPTED` | `organizationId` | `/organizations/:organizationId/settings` |
| `PROJECT_ADDED` | `projectId` | `/projects/:projectId` |
| `REVIEW_COMMENT` | `testSuiteId` | `/test-suites/:testSuiteId` |
| `TEST_COMPLETED` | `executionId` | `/executions/:executionId` |
| `TEST_FAILED` | `executionId` | `/executions/:executionId` |
| `USAGE_ALERT` | - | ナビゲーションなし |
| `BILLING` | - | ナビゲーションなし |
| `SECURITY_ALERT` | - | ナビゲーションなし |

`data` が `null` または必要なプロパティが欠損・空文字・非文字列の場合はナビゲーションしない。

---

## Phase 1: RED - テストを先に書く

### Step 1.1: 純粋関数のテスト作成

**新規**: `apps/web/src/lib/__tests__/notification-navigation.test.ts`

テストケース:
- 各通知タイプ (6種) で正しいパスを返す
- 各通知タイプで必要なプロパティが欠損時に `null` を返す
- ナビゲーションしないタイプ (3種) で `null` を返す
- 全タイプで `data: null` の場合に `null` を返す
- エッジケース: 空文字列、非文字列値、未知のタイプ

既存ファクトリ `createMockNotification()` (`src/__tests__/factories.ts`) を利用。

### Step 1.2: NotificationItem コンポーネントのテスト作成

**新規**: `apps/web/src/components/notification/__tests__/NotificationItem.test.tsx`

テストケース:
- `ORG_INVITATION` クリック → `navigate('/invitations/token-abc')` が呼ばれる
- `data: null` クリック → `navigate` が呼ばれない
- `USAGE_ALERT` クリック → `navigate` が呼ばれない
- 未読クリック → `onMarkAsRead` が呼ばれる
- 既読クリック → `onMarkAsRead` が呼ばれない
- `onClick` コールバックがナビゲーション後に呼ばれる

react-router モックパターン (Login.test.tsx と同じ):
```typescript
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});
```

---

## Phase 2: GREEN - 最小限の実装

### Step 2.1: ナビゲーションパス取得関数

**新規**: `apps/web/src/lib/notification-navigation.ts`

```typescript
export function getNotificationNavigationPath(notification: Notification): string | null
```

- `data` の存在チェック → `null` なら `null` 返却
- `switch (type)` で通知タイプ別に分岐
- 各 case で必要なプロパティが文字列かつ非空であることを検証
- `default` は `null` 返却

### Step 2.2: NotificationItem に組み込み

**修正**: `apps/web/src/components/notification/NotificationItem.tsx`

変更点（最小限）:
1. `import { useNavigate } from 'react-router'` を追加
2. `import { getNotificationNavigationPath } from '../../lib/notification-navigation'` を追加
3. コンポーネント内で `const navigate = useNavigate()` を追加
4. `handleClick` 内でナビゲーション実行:
   ```typescript
   const path = getNotificationNavigationPath(notification);
   if (path) { navigate(path); }
   ```

**修正不要なファイル**:
- `NotificationCenter.tsx` - 既存の `onClick={() => setIsOpen(false)}` がナビゲーション後に呼ばれて正常動作
- `Notifications.tsx` - NotificationItem 内部でナビゲーション完結

---

## Phase 3: REFACTOR

### Step 3.1: 型安全性の強化

`notification-navigation.ts` 内にヘルパー関数を追加:
```typescript
function getStringProp(data: Record<string, unknown>, key: string): string | null
```
`typeof` + 空文字チェックを一箇所にまとめ、各 case のキャスト (`as string`) を排除。

### Step 3.2: テストのエッジケース追加

空文字列、数値型プロパティ、未知タイプのテストを追加。

---

## ファイル一覧

| ファイル | 操作 |
|---------|------|
| `apps/web/src/lib/notification-navigation.ts` | 新規作成 |
| `apps/web/src/lib/__tests__/notification-navigation.test.ts` | 新規作成 |
| `apps/web/src/components/notification/__tests__/NotificationItem.test.tsx` | 新規作成 |
| `apps/web/src/components/notification/NotificationItem.tsx` | 修正 (import 2行 + ロジック 4行) |

## 検証方法

```bash
# ユニットテスト実行
docker compose exec dev pnpm vitest run apps/web/src/lib/__tests__/notification-navigation.test.ts
docker compose exec dev pnpm vitest run apps/web/src/components/notification/__tests__/NotificationItem.test.tsx

# ビルド確認
docker compose exec dev pnpm build --filter=web

# カバレッジ確認
docker compose exec dev pnpm vitest run --coverage apps/web
```
