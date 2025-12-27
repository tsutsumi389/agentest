# 組織復元機能と削除猶予期間表示の実装計画

## 概要
組織削除後の30日間の猶予期間中に復元する機能と、組織一覧での残り日数表示を実装する。

## 現状
- 論理削除（`deletedAt`フィールド）は実装済み
- 復元機能: **未実装**（UI/API共になし）
- 削除予定日表示: **未実装**

---

## 実装内容

### 1. バックエンド（API）

#### 1.1 Repository層
**ファイル**: `apps/api/src/repositories/organization.repository.ts`

```typescript
// 追加するメソッド
restore(id: string)              // deletedAtをnullに戻す
findDeletedById(id: string)      // 削除済み組織を取得
```

#### 1.2 Service層
**ファイル**: `apps/api/src/services/organization.service.ts`

```typescript
// 追加するメソッド
restore(organizationId: string, userId: string)  // 復元 + 監査ログ記録
```

#### 1.3 Controller層
**ファイル**: `apps/api/src/controllers/organization.controller.ts`

```typescript
// 追加するメソッド
restore = async (req, res, next) => { ... }
```

#### 1.4 Routes
**ファイル**: `apps/api/src/routes/organizations.ts`

```typescript
// 追加するルート
POST /api/organizations/:organizationId/restore  // OWNER権限
```

---

### 2. フロントエンド

#### 2.1 APIクライアント
**ファイル**: `apps/web/src/lib/api.ts`

```typescript
// 追加
restore: (organizationId: string) => api.post(...)
```

#### 2.2 OrganizationCard の拡張
**ファイル**: `apps/web/src/components/organization/OrganizationCard.tsx`

- 削除状態の視覚的表示（グレーアウト、バッジ）
- 残り日数の計算と表示
- 復元ボタンの追加

#### 2.3 組織一覧APIの修正
**ファイル**: `apps/api/src/controllers/user.controller.ts`

- 削除済み組織も含めて返すオプション追加（`includeDeleted`クエリパラメータ）

#### 2.4 OrganizationContextの修正
**ファイル**: `apps/web/src/contexts/OrganizationContext.tsx`

- 削除済み組織も取得するように修正

#### 2.5 OrganizationsPage の修正
**ファイル**: `apps/web/src/pages/Organizations.tsx`

- 削除済み組織の表示
- 復元ボタンクリック時の処理

---

### 3. 削除猶予期間の計算ロジック

```typescript
// 残り日数計算
const DELETION_GRACE_PERIOD_DAYS = 30;

function getRemainingDays(deletedAt: Date): number {
  const deletionDate = new Date(deletedAt);
  const permanentDeletionDate = new Date(deletionDate);
  permanentDeletionDate.setDate(permanentDeletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

  const now = new Date();
  const remainingMs = permanentDeletionDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
}
```

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/repositories/organization.repository.ts` | restore, findDeletedById追加 |
| `apps/api/src/services/organization.service.ts` | restore追加 |
| `apps/api/src/controllers/organization.controller.ts` | restore追加 |
| `apps/api/src/routes/organizations.ts` | POST restore追加 |
| `apps/api/src/controllers/user.controller.ts` | includeDeletedオプション追加 |
| `apps/web/src/lib/api.ts` | restore API追加 |
| `apps/web/src/components/organization/OrganizationCard.tsx` | 削除状態表示対応 |
| `apps/web/src/contexts/OrganizationContext.tsx` | 削除済み組織取得対応 |
| `apps/web/src/pages/Organizations.tsx` | 復元UI追加 |

---

## UI/UX設計

### 削除済み組織カードの表示（通常組織と同じリストに混在）
- 背景: 半透明またはグレーアウト（opacity-50等）
- バッジ: 「削除予定 あとN日」（赤色系、danger）
- ボタン: 「復元」ボタン（OWNERのみ）
- 「選択」ボタン・「設定」ボタンは非表示または非活性化

### 復元フロー
1. 復元ボタンクリック
2. 確認ダイアログ表示（シンプルなconfirm）
3. API呼び出し
4. 成功時: トースト表示 + 一覧更新
