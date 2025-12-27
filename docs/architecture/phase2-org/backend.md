# Phase 2: バックエンド詳細設計

## 概要

組織・権限管理機能のバックエンド実装詳細。サービス層、コントローラ層、リポジトリ層の設計と実装を記述する。

---

## API エンドポイント一覧

### 組織管理

| メソッド | パス | 認証 | 権限 | 説明 |
|---------|------|------|------|------|
| POST | `/api/organizations` | 必要 | - | 組織作成 |
| GET | `/api/organizations/:organizationId` | 必要 | - | 組織詳細取得 |
| PATCH | `/api/organizations/:organizationId` | 必要 | OWNER/ADMIN | 組織更新 |
| DELETE | `/api/organizations/:organizationId` | 必要 | OWNER | 組織削除（論理） |
| POST | `/api/organizations/:organizationId/restore` | 必要 | OWNER* | 組織復元 |

*削除済み組織への操作を許可

### メンバー管理

| メソッド | パス | 認証 | 権限 | 説明 |
|---------|------|------|------|------|
| GET | `/api/organizations/:organizationId/members` | 必要 | - | メンバー一覧 |
| PATCH | `/api/organizations/:organizationId/members/:userId` | 必要 | OWNER/ADMIN | ロール変更 |
| DELETE | `/api/organizations/:organizationId/members/:userId` | 必要 | OWNER/ADMIN | メンバー削除 |
| POST | `/api/organizations/:organizationId/transfer-ownership` | 必要 | OWNER | オーナー移譲 |

### 招待管理

| メソッド | パス | 認証 | 権限 | 説明 |
|---------|------|------|------|------|
| GET | `/api/organizations/invitations/:token` | 不要 | - | 招待詳細取得 |
| POST | `/api/organizations/invitations/:token/accept` | 必要 | - | 招待承諾 |
| POST | `/api/organizations/invitations/:token/decline` | 必要 | - | 招待辞退 |
| GET | `/api/organizations/:organizationId/invitations` | 必要 | OWNER/ADMIN | 招待一覧 |
| POST | `/api/organizations/:organizationId/invitations` | 必要 | OWNER/ADMIN | 招待送信 |
| DELETE | `/api/organizations/:organizationId/invitations/:invitationId` | 必要 | OWNER/ADMIN | 招待取消 |

### 監査ログ

| メソッド | パス | 認証 | 権限 | 説明 |
|---------|------|------|------|------|
| GET | `/api/organizations/:organizationId/audit-logs` | 必要 | OWNER/ADMIN | 監査ログ取得 |

### プロジェクト

| メソッド | パス | 認証 | 権限 | 説明 |
|---------|------|------|------|------|
| GET | `/api/organizations/:organizationId/projects` | 必要 | - | プロジェクト一覧 |

---

## ルート定義

**ファイル:** `apps/api/src/routes/organizations.ts`

```typescript
import { Router } from 'express';
import { requireAuth, requireOrgRole } from '@agentest/auth';
import { OrganizationController } from '../controllers/organization.controller';

const router = Router();
const controller = new OrganizationController();

// 招待トークンルート（organizationId より先に定義）
router.get('/invitations/:token', controller.getInvitationByToken);
router.post('/invitations/:token/accept', requireAuth, controller.acceptInvitation);
router.post('/invitations/:token/decline', requireAuth, controller.declineInvitation);

// 組織 CRUD
router.post('/', requireAuth, controller.create);
router.get('/:organizationId', requireAuth, controller.getById);
router.patch('/:organizationId', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.update);
router.delete('/:organizationId', requireAuth, requireOrgRole(['OWNER']), controller.delete);
router.post('/:organizationId/restore', requireAuth, requireOrgRole(['OWNER'], { allowDeletedOrg: true }), controller.restore);

// メンバー管理
router.get('/:organizationId/members', requireAuth, controller.getMembers);
router.patch('/:organizationId/members/:userId', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.updateMemberRole);
router.delete('/:organizationId/members/:userId', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.removeMember);
router.post('/:organizationId/transfer-ownership', requireAuth, requireOrgRole(['OWNER']), controller.transferOwnership);

// 招待管理
router.get('/:organizationId/invitations', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.getInvitations);
router.post('/:organizationId/invitations', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.invite);
router.delete('/:organizationId/invitations/:invitationId', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.cancelInvitation);

// プロジェクト
router.get('/:organizationId/projects', requireAuth, controller.getProjects);

// 監査ログ
router.get('/:organizationId/audit-logs', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), controller.getAuditLogs);

export default router;
```

**注意:** `/invitations/:token` ルートは `/:organizationId` より前に定義し、パスマッチングの優先度を確保する。

---

## コントローラ

**ファイル:** `apps/api/src/controllers/organization.controller.ts`

### バリデーションスキーマ

```typescript
// 組織作成
const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  description: z.string().max(500).optional(),
});

// 組織更新
const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  billingEmail: z.string().email().optional().nullable(),
});

// メンバー招待
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
});

// ロール更新
const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

// オーナー移譲
const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

// 監査ログクエリ
const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.enum(['AUTH', 'USER', 'ORGANIZATION', 'MEMBER', 'PROJECT', 'API_TOKEN', 'BILLING']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: 'startDate must be before or equal to endDate' }
);
```

### メソッド一覧

| メソッド | 説明 | レスポンス |
|----------|------|-----------|
| `create` | 組織作成 | `{ organization }` |
| `getById` | 組織詳細取得 | `{ organization }` |
| `update` | 組織更新 | `{ organization }` |
| `delete` | 組織削除 | `204 No Content` |
| `restore` | 組織復元 | `{ organization }` |
| `getMembers` | メンバー一覧 | `{ members }` |
| `invite` | メンバー招待 | `{ invitation, invitationUrl }` |
| `getInvitationByToken` | 招待詳細取得 | `{ invitation, organization, status }` |
| `acceptInvitation` | 招待承諾 | `{ organization, role }` |
| `declineInvitation` | 招待辞退 | `204 No Content` |
| `getInvitations` | 招待一覧 | `{ invitations }` |
| `cancelInvitation` | 招待取消 | `204 No Content` |
| `updateMemberRole` | ロール更新 | `{ member }` |
| `removeMember` | メンバー削除 | `204 No Content` |
| `transferOwnership` | オーナー移譲 | `{ organization }` |
| `getProjects` | プロジェクト一覧 | `{ projects }` |
| `getAuditLogs` | 監査ログ取得 | `{ logs, total, page, limit }` |

---

## サービス層

### OrganizationService

**ファイル:** `apps/api/src/services/organization.service.ts`

#### 組織管理メソッド

```typescript
class OrganizationService {
  // 組織作成
  // - スラッグ重複チェック
  // - トランザクションで組織作成 + OWNER メンバーシップ作成
  // - 監査ログ記録
  async create(userId: string, data: CreateOrganizationDto): Promise<Organization>;

  // 組織詳細取得（メンバー数含む）
  async findById(organizationId: string): Promise<Organization | null>;

  // 組織更新
  // - 監査ログ記録（更新項目を詳細に記録）
  async update(organizationId: string, data: UpdateOrganizationDto, userId?: string): Promise<Organization>;

  // 組織論理削除
  // - deletedAt を現在日時に設定
  // - 監査ログ記録
  async softDelete(organizationId: string, userId?: string): Promise<void>;

  // 組織復元
  // - 30日以内かチェック
  // - deletedAt を null に設定
  // - 監査ログ記録
  async restore(organizationId: string, userId: string): Promise<Organization>;
}
```

#### メンバー管理メソッド

```typescript
class OrganizationService {
  // メンバー一覧取得
  async getMembers(organizationId: string): Promise<OrganizationMember[]>;

  // ロール更新
  // - OWNER への変更は不可（transferOwnership を使用）
  // - 監査ログ記録（前後のロールを記録）
  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER',
    performedByUserId?: string
  ): Promise<OrganizationMember>;

  // メンバー削除
  // - OWNER は削除不可
  // - 監査ログ記録
  async removeMember(
    organizationId: string,
    targetUserId: string,
    performedByUserId?: string
  ): Promise<void>;

  // オーナー移譲
  // - 新オーナーがメンバーか確認
  // - トランザクションで現オーナー→ADMIN、新オーナー→OWNER
  // - 監査ログ記録
  async transferOwnership(
    organizationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void>;
}
```

#### 招待管理メソッド

```typescript
class OrganizationService {
  // 招待送信
  // - 既存メンバーチェック
  // - 同一メール・組織の未処理招待チェック
  // - トークン生成（UUID、7日有効）
  // - 監査ログ記録
  async invite(
    organizationId: string,
    invitedByUserId: string,
    data: InviteDto
  ): Promise<OrganizationInvitation>;

  // 招待詳細取得（トークンベース）
  // - ステータス判定: pending/accepted/declined/expired
  async getInvitationByToken(token: string): Promise<InvitationDetail>;

  // 招待承諾
  // - メールアドレス一致確認
  // - 有効期限確認
  // - トランザクションでメンバー作成 + 招待更新
  // - 監査ログ記録
  async acceptInvitation(token: string, userId: string): Promise<AcceptResult>;

  // 招待辞退
  // - 監査ログ記録
  async declineInvitation(token: string, userId: string): Promise<void>;

  // 招待取消
  // - 監査ログ記録
  async cancelInvitation(
    organizationId: string,
    invitationId: string,
    userId?: string
  ): Promise<void>;

  // 保留中招待一覧
  async getPendingInvitations(organizationId: string): Promise<OrganizationInvitation[]>;
}
```

### AuditLogService

**ファイル:** `apps/api/src/services/audit-log.service.ts`

```typescript
interface AuditLogCreateParams {
  userId?: string;           // 操作者 ID
  organizationId?: string;   // 組織 ID
  category: AuditLogCategory;
  action: string;            // 例: 'organization.created'
  targetType?: string;       // 例: 'organization', 'member'
  targetId?: string;         // 対象リソースの ID
  details?: Record<string, unknown>;  // 追加情報
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLogQueryOptions {
  page?: number;             // デフォルト: 1
  limit?: number;            // デフォルト: 50, 最大: 100
  category?: AuditLogCategory;
  startDate?: Date;
  endDate?: Date;
}

class AuditLogService {
  // ログ記録
  // - 失敗時はエラーを握りつぶし（メイン処理に影響なし）
  // - action が空の場合はスキップ
  async log(params: AuditLogCreateParams): Promise<void>;

  // 組織別ログ取得
  // - ページネーション対応
  // - カテゴリ・日付範囲フィルタ
  async getByOrganization(
    organizationId: string,
    options: AuditLogQueryOptions
  ): Promise<{ logs: AuditLog[]; total: number }>;

  // ユーザー別ログ取得（組織に属さない操作）
  async getByUser(
    userId: string,
    options: AuditLogQueryOptions
  ): Promise<{ logs: AuditLog[]; total: number }>;
}
```

---

## リポジトリ層

### OrganizationRepository

**ファイル:** `apps/api/src/repositories/organization.repository.ts`

```typescript
class OrganizationRepository {
  // 組織検索（deletedAt=null のみ）
  async findById(id: string): Promise<Organization | null>;

  // スラッグで検索
  async findBySlug(slug: string): Promise<Organization | null>;

  // 組織更新
  async update(id: string, data: Partial<Organization>): Promise<Organization>;

  // 論理削除（deletedAt 設定）
  async softDelete(id: string): Promise<void>;

  // 削除済み組織検索（deletedAt != null）
  async findDeletedById(id: string): Promise<Organization | null>;

  // 組織復元（deletedAt を null に）
  async restore(id: string): Promise<Organization>;
}
```

### AuditLogRepository

**ファイル:** `apps/api/src/repositories/audit-log.repository.ts`

```typescript
class AuditLogRepository {
  // ログ作成
  async create(data: AuditLogCreateParams): Promise<AuditLog>;

  // 組織別検索
  // - ユーザー情報（id, email, name, avatarUrl）を include
  // - 作成日時降順ソート
  async findByOrganization(
    organizationId: string,
    options: FindOptions
  ): Promise<{ logs: AuditLog[]; total: number }>;

  // ユーザー別検索（organizationId=null のみ）
  async findByUser(
    userId: string,
    options: FindOptions
  ): Promise<{ logs: AuditLog[]; total: number }>;
}
```

---

## エラーハンドリング

### カスタム例外クラス

```typescript
// リソース重複エラー
class ConflictError extends Error {
  statusCode = 409;
}

// リソース未検出エラー
class NotFoundError extends Error {
  statusCode = 404;
}

// 認可エラー
class AuthorizationError extends Error {
  statusCode = 403;
}

// 認証エラー
class AuthenticationError extends Error {
  statusCode = 401;
}
```

### 発生箇所

| 例外 | 発生箇所 | 条件 |
|------|----------|------|
| ConflictError | create | スラッグ重複 |
| ConflictError | invite | 既存メンバー、重複招待 |
| ConflictError | acceptInvitation | 既にメンバー |
| NotFoundError | findById | 組織が存在しない |
| NotFoundError | updateMemberRole | メンバーが存在しない |
| NotFoundError | getInvitationByToken | 招待が存在しない |
| AuthorizationError | acceptInvitation | メールアドレス不一致 |
| AuthorizationError | restore | 猶予期間超過 |

---

## トランザクション処理

以下の操作はトランザクションで実行し、データ整合性を担保する：

### 組織作成

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 組織作成
  const organization = await tx.organization.create({ data });

  // 2. 作成者を OWNER として追加
  await tx.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId,
      role: 'OWNER',
    },
  });

  return organization;
});
```

### 招待承諾

```typescript
await prisma.$transaction(async (tx) => {
  // 1. メンバー作成
  await tx.organizationMember.create({
    data: {
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
    },
  });

  // 2. 招待を承諾済みに更新
  await tx.organizationInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });
});
```

### オーナー移譲

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 現オーナーを ADMIN に降格
  await tx.organizationMember.update({
    where: {
      organizationId_userId: { organizationId, userId: currentOwnerId }
    },
    data: { role: 'ADMIN' },
  });

  // 2. 新メンバーを OWNER に昇格
  await tx.organizationMember.update({
    where: {
      organizationId_userId: { organizationId, userId: newOwnerId }
    },
    data: { role: 'OWNER' },
  });
});
```

---

## 定数・設定値

**ファイル:** `packages/shared/src/config/constants.ts`

```typescript
// 組織削除の猶予期間（日）
export const DELETION_GRACE_PERIOD_DAYS = 30;
```

**ファイル:** `apps/api/src/services/audit-log.service.ts`

```typescript
// 監査ログのデフォルト取得件数
const AUDIT_LOG_DEFAULT_LIMIT = 50;

// 監査ログの最大取得件数
const AUDIT_LOG_MAX_LIMIT = 100;
```

**ファイル:** `apps/api/src/services/organization.service.ts`

```typescript
// 招待トークンの有効期間（日）
const INVITATION_EXPIRY_DAYS = 7;
```
