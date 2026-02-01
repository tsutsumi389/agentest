# 全体監査ログ閲覧機能（ADM-AUD-001）実装計画

## 概要

システム管理者が全組織・全ユーザーの監査ログを横断的に閲覧・検索できる機能を実装する。

## 実装ファイル一覧

### Phase 1: 共有型定義（packages/shared）

| ファイル | 操作 | 責務 |
|----------|------|------|
| `src/types/admin-audit-logs.ts` | 新規 | 検索パラメータ、レスポンス型定義 |
| `src/types/index.ts` | 更新 | エクスポート追加 |

### Phase 2: バックエンドAPI（apps/api）

| ファイル | 操作 | 責務 |
|----------|------|------|
| `src/services/admin/admin-audit-logs.service.ts` | 新規 | クエリ構築、データ取得、レスポンス変換 |
| `src/routes/admin/audit-logs.ts` | 新規 | GET /admin/audit-logs エンドポイント |
| `src/routes/admin/index.ts` | 更新 | ルート登録追加 |

### Phase 3: フロントエンド（apps/admin）

| ファイル | 操作 | 責務 |
|----------|------|------|
| `src/lib/api.ts` | 更新 | adminAuditLogsApi追加 |
| `src/hooks/useAdminAuditLogs.ts` | 新規 | React Queryフック |
| `src/components/audit-logs/index.ts` | 新規 | バレルエクスポート |
| `src/components/audit-logs/AuditLogTable.tsx` | 新規 | テーブル（ソート対応） |
| `src/components/audit-logs/AuditLogFilters.tsx` | 新規 | フィルターUI |
| `src/components/audit-logs/AuditLogSearchForm.tsx` | 新規 | 検索フォーム（デバウンス） |
| `src/components/audit-logs/AuditLogDetailModal.tsx` | 新規 | 詳細JSON展開表示 |
| `src/pages/AuditLogs.tsx` | 新規 | メインページ |
| `src/App.tsx` | 更新 | /audit-logs ルート追加 |
| `src/components/layout/nav-links.ts` | 更新 | ナビリンク追加 |

---

## API設計

### エンドポイント

```
GET /admin/audit-logs
```

### リクエストパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|------------|------|------------|------|
| `q` | string | - | アクション名で部分一致検索 |
| `category` | string | - | カンマ区切り: AUTH,USER,ORGANIZATION,MEMBER,PROJECT,API_TOKEN,BILLING |
| `organizationId` | UUID | - | 組織IDでフィルタ |
| `userId` | UUID | - | ユーザーIDでフィルタ |
| `startDate` | ISO8601 | - | 開始日時 |
| `endDate` | ISO8601 | - | 終了日時 |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 50 | 件数（最大100） |
| `sortBy` | string | createdAt | ソート項目 |
| `sortOrder` | string | desc | asc/desc |

### レスポンス

```typescript
interface AdminAuditLogListResponse {
  auditLogs: {
    id: string;
    category: AuditLogCategory;
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    organization: { id: string; name: string } | null;
    user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```

---

## 画面レイアウト

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 監査ログ                                        [🔄 更新]   │
│  システム全体の操作履歴を閲覧                                    │
├─────────────────────────────────────────────────────────────────┤
│  検索・フィルター                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 🔍 [アクションで検索...                            ] [✕]   │ │
│  │ カテゴリ: [AUTH] [USER] [ORGANIZATION] [MEMBER] ...       │ │
│  │ 組織:     [▼ 組織を選択   ]  ユーザー: [▼ ユーザーを選択] │ │
│  │ 日時:     [____-__-__] 〜 [____-__-__]           [クリア]  │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  テーブル                                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 日時▼ │カテゴリ│アクション│対象│組織│ユーザー│IP│詳細   │ │
│  │ 5分前 │AUTH    │login    │User│Acme│山田    │.4│ [👁]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│  500件中 1-50件を表示              [◀ 前へ] 1/10 [次へ ▶]       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 実装順序

1. **packages/shared**: 型定義（AdminAuditLogSearchParams, AdminAuditLogListResponse）
2. **apps/api/services**: AdminAuditLogsService（WHERE句構築、Prismaクエリ）
3. **apps/api/routes**: GET /admin/audit-logs エンドポイント
4. **apps/admin/lib/api.ts**: APIクライアント追加
5. **apps/admin/hooks**: useAdminAuditLogsフック
6. **apps/admin/components**: AuditLogSearchForm, AuditLogFilters, AuditLogTable, AuditLogDetailModal
7. **apps/admin/pages**: AuditLogs.tsx（Organizations.tsxパターン準拠）
8. **ルーティング**: App.tsx, nav-links.ts 更新

---

## 参照ファイル（実装パターン）

- `apps/admin/src/pages/Organizations.tsx` - URLSearchParams状態管理パターン
- `apps/api/src/services/admin/admin-organizations.service.ts` - WHERE句構築、キャッシュパターン
- `apps/admin/src/components/organizations/OrganizationAuditLogSection.tsx` - テーブルUIパターン
- `apps/api/src/repositories/audit-log.repository.ts` - 既存の監査ログクエリ

---

## 検証方法

1. **API動作確認**
   - `GET /admin/audit-logs` でページネーション動作確認
   - フィルタ組み合わせ（カテゴリ+組織+日時）の動作確認

2. **フロントエンド確認**
   - 検索フォームでデバウンス動作確認
   - フィルター変更でURL同期確認
   - 詳細モーダルでJSON展開表示確認
   - ページ遷移の動作確認

3. **E2Eフロー**
   - ナビゲーション → 検索 → フィルタ → 詳細表示 の一連の操作
