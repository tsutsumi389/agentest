# システム管理者機能 実装順序・優先度

## 概要

`docs/requirements/admin-system.md` に定義されたシステム管理者機能の実装順序と優先度を定義する。
既存の実装基盤を最大限活用し、依存関係を考慮した段階的な実装を行う。

---

## 既存資産の確認

### 実装済み（活用可能）
| 資産 | 状況 | 活用方法 |
|------|------|----------|
| AuditLog | フルスタック実装済み | 管理者監査ログの基盤として拡張 |
| Subscription/Invoice | DBスキーマ定義済み | 課金管理APIで直接利用 |
| User/Organization | 完全実装済み | 管理画面から操作対象として参照 |
| apps/admin/ | スケルトン実装 | 管理画面フロントエンドの土台 |
| 認可パターン | requireOrgRole等 | requireAdminRoleの参考 |

### 新規実装が必要
| 項目 | 優先度 |
|------|--------|
| AdminUser, AdminRole, AdminSession テーブル | 最優先（すべての前提） |
| 管理者認証API（2FA含む） | 最優先 |
| 管理画面用APIエンドポイント群 | 高 |
| AdminAuditLog テーブル | 高 |
| フロントエンド画面群 | 中〜高 |

---

## 実装フェーズ

### Phase 0: 基盤整備（最優先）
**目的**: 管理者認証・認可の基盤を構築

| 順序 | ID | 機能 | 工数目安 | 依存 |
|:----:|:---|:-----|:--------:|:----:|
| 0-1 | DB | AdminUser, AdminRole, AdminSession テーブル追加 | - | なし |
| 0-2 | DB | AdminAuditLog テーブル追加 | - | 0-1 |
| 0-3 | API | 管理者ログインAPI（メール/パスワード） | - | 0-1 |
| 0-4 | API | 管理者2FA（TOTP）API | - | 0-3 |
| 0-5 | MW | requireAdminRole ミドルウェア | - | 0-1 |
| 0-6 | FE | 管理者ログイン画面 | - | 0-3,0-4 |

**Prismaスキーマ追加例**:
```prisma
enum AdminRoleType {
  SUPER_ADMIN
  ADMIN
  VIEWER
}

model AdminUser {
  id           String        @id @default(uuid())
  email        String        @unique
  passwordHash String
  name         String
  role         AdminRoleType @default(ADMIN)
  totpSecret   String?
  totpEnabled  Boolean       @default(false)
  failedAttempts Int         @default(0)
  lockedUntil  DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  sessions     AdminSession[]
  auditLogs    AdminAuditLog[]
}

model AdminSession {
  id          String    @id @default(uuid())
  adminUserId String
  token       String    @unique
  ipAddress   String?
  userAgent   String?
  lastActiveAt DateTime @default(now())
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  adminUser   AdminUser @relation(fields: [adminUserId], references: [id])
}

model AdminAuditLog {
  id          String   @id @default(uuid())
  adminUserId String
  action      String
  targetType  String?
  targetId    String?
  details     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  adminUser   AdminUser @relation(fields: [adminUserId], references: [id])
}
```

---

### Phase 1: MVP機能 - 閲覧系（高優先）
**目的**: ダッシュボードと一覧・詳細閲覧機能

| 順序 | ID | 機能 | 権限 | 依存 |
|:----:|:---|:-----|:----:|:----:|
| 1-1 | ADM-MON-001 | システムダッシュボード | ALL | Phase 0 |
| 1-2 | ADM-USR-001 | ユーザー一覧 | ALL | Phase 0 |
| 1-3 | ADM-USR-002 | ユーザー詳細 | ALL | 1-2 |
| 1-4 | ADM-ORG-001 | 組織一覧 | ALL | Phase 0 |
| 1-5 | ADM-ORG-002 | 組織詳細 | ALL | 1-4 |
| 1-6 | ADM-AUD-001 | 全体監査ログ閲覧 | ALL | Phase 0 |
| 1-7 | ADM-AUD-002 | 監査ログ検索 | ALL | 1-6 |
| 1-8 | ADM-SYS-001 | システムヘルスチェック | ALL | Phase 0 |

**実装のポイント**:
- 既存のUser, Organizationテーブルをそのまま参照
- 既存のAuditLogServiceを拡張（組織横断検索機能追加）
- ダッシュボードは集計クエリで実装

---

### Phase 2: MVP機能 - 操作系（高優先）
**目的**: ユーザー・組織の管理操作

| 順序 | ID | 機能 | 権限 | 依存 |
|:----:|:---|:-----|:----:|:----:|
| 2-1 | ADM-USR-003 | ユーザー停止 | SUPER_ADMIN, ADMIN | 1-3 |
| 2-2 | ADM-USR-004 | ユーザー有効化 | SUPER_ADMIN, ADMIN | 2-1 |
| 2-3 | ADM-USR-005 | ユーザー削除（GDPR対応） | SUPER_ADMIN | 1-3 |
| 2-4 | ADM-ORG-003 | 組織停止 | SUPER_ADMIN, ADMIN | 1-5 |
| 2-5 | ADM-ORG-004 | 組織有効化 | SUPER_ADMIN, ADMIN | 2-4 |
| 2-6 | ADM-ORG-005 | 組織削除 | SUPER_ADMIN | 1-5 |
| 2-7 | ADM-AUD-003 | 監査ログエクスポート | ALL | 1-7 |

**実装のポイント**:
- ユーザー停止: `status` フィールド追加 or `suspendedAt` フィールド追加
- GDPR対応削除: 個人情報の匿名化処理
- すべての操作をAdminAuditLogに記録

---

### Phase 3: MVP機能 - 課金管理（中優先）
**目的**: サブスクリプション・請求書の管理

| 順序 | ID | 機能 | 権限 | 依存 |
|:----:|:---|:-----|:----:|:----:|
| 3-1 | ADM-BIL-001 | 契約一覧 | ALL | Phase 0 |
| 3-2 | ADM-BIL-002 | 契約詳細 | ALL | 3-1 |
| 3-3 | ADM-BIL-004 | 請求書一覧 | ALL | Phase 0 |
| 3-4 | ADM-BIL-005 | 請求書詳細 | ALL | 3-3 |
| 3-5 | ADM-BIL-003 | プラン変更 | SUPER_ADMIN, ADMIN | 3-2 |
| 3-6 | ADM-BIL-006 | 支払いステータス管理 | SUPER_ADMIN, ADMIN | 3-4 |

**実装のポイント**:
- 既存のSubscription, Invoiceテーブルを直接参照
- プラン変更は監査ログ必須
- 外部決済連携は将来対応（Stripe等）

---

### Phase 4: MVP機能 - 運用系（中優先）
**目的**: お知らせ、システム監視、管理者管理

| 順序 | ID | 機能 | 権限 | 依存 |
|:----:|:---|:-----|:----:|:----:|
| 4-1 | DB | SystemAnnouncement, MaintenanceNotice テーブル追加 | - | なし |
| 4-2 | ADM-NTF-001 | システムお知らせ作成 | SUPER_ADMIN, ADMIN | 4-1 |
| 4-3 | ADM-NTF-002 | メンテナンス通知 | SUPER_ADMIN, ADMIN | 4-1 |
| 4-4 | ADM-SYS-002 | エラーログ閲覧 | ALL | Phase 0 |
| 4-5 | ADM-MON-002 | アクティブユーザー推移 | ALL | 1-1 |
| 4-6 | ADM-MON-003 | プラン別ユーザー分布 | ALL | 1-1 |

---

### Phase 5: MVP機能 - セキュリティ（高優先）
**目的**: 管理者アカウント管理とセキュリティ強化

| 順序 | ID | 機能 | 権限 | 依存 |
|:----:|:---|:-----|:----:|:----:|
| 5-1 | ADM-SEC-001 | 管理者アカウント一覧 | SUPER_ADMIN | Phase 0 |
| 5-2 | ADM-SEC-002 | 管理者ロール管理 | SUPER_ADMIN | 5-1 |
| 5-3 | ADM-SEC-003 | 管理者監査ログ | ALL | Phase 0 |
| 5-4 | ADM-SEC-004 | 2FA強制 | SUPER_ADMIN | 0-4 |

**非機能要件の実装**:
- パスワードポリシー: 12文字以上、大小英字・数字・記号
- ログイン試行制限: 5回失敗で30分ロック
- セッション有効期限: 2時間（最大8時間延長）

---

## 実装優先度サマリー

```
[最優先] Phase 0: 管理者認証基盤
    ↓
[高優先] Phase 1: 閲覧系機能（ダッシュボード、一覧、詳細）
    ↓
[高優先] Phase 2: 操作系機能（停止、有効化、削除）
    ↓
[高優先] Phase 5: セキュリティ（管理者アカウント管理、2FA強制）
    ↓
[中優先] Phase 3: 課金管理
    ↓
[中優先] Phase 4: 運用系（お知らせ、モニタリング詳細）
```

---

## MVP リリース要件

### 必須（リリースブロッカー）
- [ ] Phase 0: 管理者認証基盤（全機能）
- [ ] Phase 1: 閲覧系機能（全機能）
- [ ] Phase 2: ADM-USR-003〜005（ユーザー停止/有効化/削除）
- [ ] Phase 2: ADM-ORG-003〜005（組織停止/有効化/削除）
- [ ] Phase 5: ADM-SEC-001〜004（管理者管理、2FA）

### 推奨（MVPに含めたい）
- [ ] Phase 3: ADM-BIL-001〜002（契約一覧・詳細）
- [ ] Phase 4: ADM-NTF-001〜002（お知らせ機能）

### 後続リリース
- [ ] Phase 3: ADM-BIL-003〜006（課金操作）
- [ ] Phase 4: ADM-MON-002〜003（詳細モニタリング）

---

## 検証方法

### 認証基盤
1. 管理者アカウント作成（DBシード）
2. ログイン → 2FA認証 → セッション取得
3. 5回ログイン失敗 → 30分ロック確認
4. セッション有効期限切れ確認

### 管理機能
1. ユーザー一覧 → 詳細 → 停止 → 有効化 → 削除
2. 組織一覧 → 詳細 → 停止 → 有効化 → 削除
3. 監査ログ検索 → エクスポート（CSV/JSON）
4. ダッシュボード統計表示確認

### セキュリティ
1. 権限マトリクスに従ったアクセス制御確認
2. VIEWER ロールで操作不可確認
3. ADMIN ロールで削除不可確認
4. すべての操作がAdminAuditLogに記録されること

---

## 関連ファイル

### 既存（参照・拡張）
- `packages/db/prisma/schema.prisma`
- `apps/api/src/services/audit-log.service.ts`
- `apps/api/src/middleware/require-org-role.ts`
- `apps/admin/src/pages/Dashboard.tsx`

### 新規作成
- `apps/api/src/routes/admin/` - 管理者用APIルート
- `apps/api/src/services/admin/` - 管理者用サービス
- `apps/api/src/middleware/require-admin-role.ts`
- `apps/admin/src/pages/users/` - ユーザー管理画面
- `apps/admin/src/pages/organizations/` - 組織管理画面
- `apps/admin/src/pages/billing/` - 課金管理画面
