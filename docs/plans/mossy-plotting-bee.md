# 監査ログ閲覧・フィルタ機能 拡張実装計画

## 概要

既存の監査ログ機能（AuditLogList.tsx）に以下の機能を追加する：
1. **詳細表示機能** - ログをクリックして詳細情報を表示
2. **エクスポート機能** - CSV/JSON形式でダウンロード

## 現状

### 既存実装
- **モデル**: `AuditLog` (packages/db/prisma/schema.prisma:1096-1118)
- **API**: `GET /api/organizations/:organizationId/audit-logs`
- **UI**: `apps/web/src/components/organization/AuditLogList.tsx`
- **既存フィルタ**: カテゴリ、日付範囲（今日/7日/30日/90日）、ページサイズ、ページネーション

### AuditLogの構造
```typescript
{
  id: string;
  organizationId: string | null;
  userId: string | null;
  category: 'AUTH' | 'USER' | 'ORGANIZATION' | 'MEMBER' | 'PROJECT' | 'API_TOKEN' | 'BILLING';
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;  // 詳細情報（JSON）
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id, email, name, avatarUrl } | null;
}
```

---

## 実装計画

### Phase 1: 監査ログ詳細表示機能

#### 1.1 AuditLogDetailModal.tsx（新規作成）

**ファイル**: `apps/web/src/components/organization/AuditLogDetailModal.tsx`

```typescript
interface AuditLogDetailModalProps {
  log: AuditLog | null;
  isOpen: boolean;
  onClose: () => void;
}
```

**表示内容**:
- ヘッダー: カテゴリバッジ + アクション名
- 日時: 絶対時刻表示
- 実行ユーザー: アバター、名前、メールアドレス
- 対象リソース: targetType + targetId（リンク可能な場合はリンク表示）
- アクセス情報: IPアドレス、UserAgent
- 詳細情報: details JSONをキー/バリュー形式で整形表示

**UIデザイン**:
- 既存のモーダルパターンに従う（ModalPortal使用）
- ダークテーマ準拠
- ESCキーで閉じる

#### 1.2 AuditLogList.tsx の修正

**修正内容**:
- ログ行をクリック可能にする（cursor-pointer, hover効果）
- 選択中のログを state で管理
- AuditLogDetailModal を表示

```typescript
// 追加state
const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

// 行クリックハンドラ
const handleLogClick = (log: AuditLog) => {
  setSelectedLog(log);
};
```

---

### Phase 2: 監査ログエクスポート機能

#### 2.1 バックエンドAPI

**新規エンドポイント**: `GET /api/organizations/:organizationId/audit-logs/export`

**ファイル修正**:
- `apps/api/src/routes/organizations.ts` - ルート追加
- `apps/api/src/controllers/organization.controller.ts` - exportAuditLogs メソッド追加
- `apps/api/src/services/audit-log.service.ts` - export メソッド追加

**クエリパラメータ**:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| format | 'csv' \| 'json' | Yes | 出力形式 |
| category | string | No | カテゴリフィルタ |
| startDate | string (ISO 8601) | No | 開始日時 |
| endDate | string (ISO 8601) | No | 終了日時 |

**レスポンス**:
- Content-Type: `text/csv; charset=utf-8` または `application/json`
- Content-Disposition: `attachment; filename="audit-logs-{YYYYMMDD-HHmmss}.{csv|json}"`
- BOM付きCSV（Excel対応）

**制限**:
- 最大10,000件
- 権限: OWNER/ADMIN のみ（既存と同じ）

**CSV形式**:
```csv
ID,日時,カテゴリ,アクション,ユーザー,対象タイプ,対象ID,IPアドレス,詳細
uuid,2025-01-21T10:00:00Z,AUTH,LOGIN,user@example.com,null,null,192.168.1.1,"{...}"
```

#### 2.2 バリデーションスキーマ

**ファイル**: `packages/shared/src/validators/schemas.ts`

```typescript
export const auditLogExportSchema = z.object({
  format: z.enum(['csv', 'json']),
  category: z.nativeEnum(AuditLogCategory).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```

#### 2.3 フロントエンドUI

**AuditLogList.tsx への追加**:
- エクスポートボタン（フィルタエリア右端）
- 形式選択ドロップダウン

```tsx
// エクスポートボタン
<div className="relative">
  <button
    onClick={() => setShowExportMenu(!showExportMenu)}
    className="btn btn-secondary"
  >
    <Download className="w-4 h-4 mr-1" />
    エクスポート
  </button>
  {showExportMenu && (
    <div className="absolute right-0 mt-1 ...">
      <button onClick={() => handleExport('csv')}>CSV形式</button>
      <button onClick={() => handleExport('json')}>JSON形式</button>
    </div>
  )}
</div>
```

**api.ts への追加**:
```typescript
export function exportAuditLogs(
  organizationId: string,
  params: { format: 'csv' | 'json'; category?: string; startDate?: string; endDate?: string }
): Promise<Blob> {
  // fetch with responseType: blob
}
```

---

## ファイル一覧

### 新規作成
| ファイル | 説明 |
|---------|------|
| `apps/web/src/components/organization/AuditLogDetailModal.tsx` | 監査ログ詳細モーダル |

### 修正
| ファイル | 修正内容 |
|---------|---------|
| `apps/web/src/components/organization/AuditLogList.tsx` | 詳細モーダル表示、エクスポートボタン追加 |
| `apps/web/src/lib/api.ts` | エクスポートAPI関数追加 |
| `apps/api/src/routes/organizations.ts` | エクスポートルート追加 |
| `apps/api/src/controllers/organization.controller.ts` | exportAuditLogs メソッド追加 |
| `apps/api/src/services/audit-log.service.ts` | export メソッド追加 |
| `packages/shared/src/validators/schemas.ts` | エクスポートスキーマ追加 |

---

## 実装順序

1. **Phase 1: 詳細表示機能**
   - [ ] AuditLogDetailModal.tsx 新規作成
   - [ ] AuditLogList.tsx 修正（クリックハンドラ、モーダル表示）

2. **Phase 2: エクスポート機能**
   - [ ] packages/shared にバリデーションスキーマ追加
   - [ ] バックエンドAPI実装（routes → controller → service）
   - [ ] フロントエンドUI実装（api.ts、AuditLogList.tsx）

---

## 検証方法

### 詳細表示機能
1. 組織設定 > 監査ログタブを開く
2. ログ行をクリック → 詳細モーダルが表示される
3. 各フィールドが正しく表示される
4. ESCキーまたは閉じるボタンでモーダルが閉じる

### エクスポート機能
1. 組織設定 > 監査ログタブを開く
2. フィルタを適用（任意）
3. エクスポートボタンをクリック
4. CSV/JSON形式を選択
5. ファイルがダウンロードされる
6. ダウンロードしたファイルの内容を確認
   - CSV: Excelで開いて文字化けしないこと
   - JSON: 有効なJSONであること
