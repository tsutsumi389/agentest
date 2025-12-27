# Phase 2: セキュリティ詳細設計

## 概要

組織・権限管理機能のセキュリティ設計。認可制御、監査ログ、データ保護の詳細を記述する。

---

## 認可制御

### ロールベースアクセス制御（RBAC）

組織内の操作は3段階のロールで制御される。

#### ロール階層

```
OWNER (オーナー)
  └── ADMIN (管理者)
        └── MEMBER (一般メンバー)
```

#### ロール定義

| ロール | 説明 | 付与方法 |
|--------|------|----------|
| OWNER | 組織の所有者。全権限を持つ | 組織作成時に自動付与、または移譲 |
| ADMIN | 管理者。メンバー管理が可能 | OWNER/ADMIN による変更 |
| MEMBER | 一般メンバー。閲覧のみ | 招待時に指定、または降格 |

### requireOrgRole ミドルウェア

**ファイル:** `packages/auth/src/middleware.ts`

```typescript
interface RequireOrgRoleOptions {
  allowDeletedOrg?: boolean; // デフォルト: false
}

export const requireOrgRole = (
  roles: OrganizationRole[],
  options?: RequireOrgRoleOptions
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('Authentication required');
    }

    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    // 組織の存在確認
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // 削除済み組織へのアクセス制御
    if (organization.deletedAt && !options?.allowDeletedOrg) {
      throw new NotFoundError('Organization not found');
    }

    // メンバーシップとロールの確認
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!membership) {
      throw new AuthorizationError('Not a member of this organization');
    }

    if (!roles.includes(membership.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }

    // リクエストに組織情報を付加
    req.organization = organization;
    req.organizationRole = membership.role;

    next();
  };
};
```

### 権限マトリクス

| 操作 | エンドポイント | OWNER | ADMIN | MEMBER |
|------|---------------|-------|-------|--------|
| 組織情報閲覧 | GET /:orgId | OK | OK | OK |
| 組織設定変更 | PATCH /:orgId | OK | OK | NG |
| 組織削除 | DELETE /:orgId | OK | NG | NG |
| 組織復元 | POST /:orgId/restore | OK | NG | NG |
| メンバー一覧 | GET /:orgId/members | OK | OK | OK |
| メンバー招待 | POST /:orgId/invitations | OK | OK | NG |
| 招待一覧 | GET /:orgId/invitations | OK | OK | NG |
| 招待取消 | DELETE /:orgId/invitations/:id | OK | OK | NG |
| ロール変更 | PATCH /:orgId/members/:userId | OK | OK* | NG |
| メンバー削除 | DELETE /:orgId/members/:userId | OK | OK* | NG |
| オーナー移譲 | POST /:orgId/transfer-ownership | OK | NG | NG |
| 監査ログ閲覧 | GET /:orgId/audit-logs | OK | OK | NG |
| プロジェクト一覧 | GET /:orgId/projects | OK | OK | OK |

*ADMIN は OWNER を操作不可

---

## 招待セキュリティ

### トークン生成

```typescript
// UUID v4 による招待トークン生成
const token = crypto.randomUUID();

// トークンの特性
// - 128ビットのランダム値
// - 予測困難
// - 一意性保証
```

### 招待トークンの検証

```typescript
async acceptInvitation(token: string, userId: string): Promise<AcceptResult> {
  // 1. トークンで招待を検索
  const invitation = await this.getInvitationByToken(token);

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  // 2. ステータス確認（未処理のみ承諾可能）
  if (invitation.acceptedAt || invitation.declinedAt) {
    throw new ConflictError('Invitation already processed');
  }

  // 3. 有効期限確認
  if (new Date(invitation.expiresAt) < new Date()) {
    throw new AuthorizationError('Invitation has expired');
  }

  // 4. メールアドレス一致確認
  const user = await this.userRepository.findById(userId);
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AuthorizationError('Email address does not match');
  }

  // 5. 既存メンバーチェック
  const existingMember = await this.memberRepository.findByOrgAndUser(
    invitation.organizationId,
    userId
  );
  if (existingMember) {
    throw new ConflictError('Already a member of this organization');
  }

  // 6. トランザクションでメンバー作成
  await this.prisma.$transaction(async (tx) => {
    await tx.organizationMember.create({ ... });
    await tx.organizationInvitation.update({ ... });
  });
}
```

### 招待の有効期限

| 設定 | 値 | 説明 |
|------|-----|------|
| INVITATION_EXPIRY_DAYS | 7日 | 招待の有効期限 |

有効期限切れの招待は承諾不可だが、データは保持される（監査目的）。

---

## 監査ログ

### 記録原則

1. **非同期・非ブロッキング**: 監査ログの記録失敗はメイン処理に影響しない
2. **包括性**: すべての重要操作を記録
3. **不変性**: 記録されたログは変更・削除不可
4. **追跡可能性**: 操作者、対象、詳細を記録

### ログ記録の実装

```typescript
class AuditLogService {
  async log(params: AuditLogCreateParams): Promise<void> {
    try {
      // action が空の場合はスキップ
      if (!params.action) return;

      await this.repository.create(params);
    } catch (error) {
      // エラーを握りつぶし、メイン処理に影響を与えない
      console.error('Failed to record audit log:', error);
    }
  }
}
```

### 記録される情報

```typescript
interface AuditLogEntry {
  // 基本情報
  id: string;
  createdAt: Date;

  // 操作者
  userId: string | null;      // 操作を実行したユーザー

  // コンテキスト
  organizationId: string | null;  // 組織スコープ

  // 操作詳細
  category: AuditLogCategory;     // AUTH, USER, ORGANIZATION, etc.
  action: string;                 // 'organization.created', 'member.invited', etc.

  // 対象
  targetType: string | null;      // 'organization', 'member', 'invitation'
  targetId: string | null;        // 対象リソースの ID

  // 詳細
  details: Record<string, unknown> | null;  // 追加情報（変更前後の値など）

  // メタデータ
  ipAddress: string | null;
  userAgent: string | null;
}
```

### 監査対象アクション

#### 組織操作

| アクション | details に含まれる情報 |
|-----------|------------------------|
| organization.created | name, slug |
| organization.updated | 変更された項目と値 |
| organization.deleted | name, slug |
| organization.restored | name, slug |
| organization.ownership_transferred | previousOwnerId, newOwnerId, newOwnerEmail |

#### メンバー操作

| アクション | details に含まれる情報 |
|-----------|------------------------|
| member.invited | email, role |
| member.invitation_accepted | email, role |
| member.invitation_declined | email |
| member.invitation_cancelled | email, role |
| member.role_updated | targetUserId, previousRole, newRole |
| member.removed | targetUserId, email, role |

### ログの保持期間

- 最低90日間保持（法的要件に基づく）
- 削除は自動化しない（管理者による手動対応）

---

## 論理削除と復元

### 削除猶予期間

```typescript
// packages/shared/src/config/constants.ts
export const DELETION_GRACE_PERIOD_DAYS = 30;
```

### 削除時の動作

```typescript
async softDelete(organizationId: string, userId?: string): Promise<void> {
  // 1. deletedAt を現在日時に設定
  await this.repository.softDelete(organizationId);

  // 2. 監査ログ記録
  await this.auditLogService.log({
    userId,
    organizationId,
    category: 'ORGANIZATION',
    action: 'organization.deleted',
    targetType: 'organization',
    targetId: organizationId,
  });

  // 注意: メンバーシップ、招待、プロジェクトは削除しない
  // 復元時にすべて復元される
}
```

### 復元時の検証

```typescript
async restore(organizationId: string, userId: string): Promise<Organization> {
  // 1. 削除済み組織を検索
  const organization = await this.repository.findDeletedById(organizationId);

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  // 2. 猶予期間内かチェック
  const deletedAt = new Date(organization.deletedAt);
  const now = new Date();
  const daysSinceDeleted = Math.floor(
    (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDeleted > DELETION_GRACE_PERIOD_DAYS) {
    throw new AuthorizationError(
      `Cannot restore organization after ${DELETION_GRACE_PERIOD_DAYS} days`
    );
  }

  // 3. 復元
  const restored = await this.repository.restore(organizationId);

  // 4. 監査ログ記録
  await this.auditLogService.log({ ... });

  return restored;
}
```

### 削除済み組織へのアクセス

- 通常の API アクセスは不可（NotFoundError）
- 復元操作のみ `allowDeletedOrg: true` で許可
- OWNER のみ復元可能

---

## 入力バリデーション

### 組織作成

```typescript
const createOrgSchema = z.object({
  name: z.string()
    .min(1, '組織名は必須です')
    .max(100, '組織名は100文字以内です'),

  slug: z.string()
    .min(1, 'スラッグは必須です')
    .max(50, 'スラッグは50文字以内です')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'スラッグは英小文字、数字、ハイフンのみ使用可能です'
    ),

  description: z.string()
    .max(500, '説明は500文字以内です')
    .optional(),
});
```

### メール招待

```typescript
const inviteSchema = z.object({
  email: z.string()
    .email('有効なメールアドレスを入力してください'),

  role: z.enum(['ADMIN', 'MEMBER'], {
    errorMap: () => ({ message: 'ロールは ADMIN または MEMBER を指定してください' }),
  }),
});
```

### 監査ログクエリ

```typescript
const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100, '取得件数は100件以内です')
    .optional(),

  category: z.enum([
    'AUTH', 'USER', 'ORGANIZATION', 'MEMBER',
    'PROJECT', 'API_TOKEN', 'BILLING'
  ]).optional(),

  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: '開始日は終了日以前である必要があります' }
);
```

---

## データ保護

### 機密データの取り扱い

| データ | 保護方法 |
|--------|----------|
| 招待トークン | UUID v4（予測困難） |
| メールアドレス | 大文字小文字を正規化して比較 |
| 監査ログ | 変更・削除不可 |

### スラッグの一意性

```typescript
async create(userId: string, data: CreateOrganizationDto): Promise<Organization> {
  // スラッグ重複チェック
  const existing = await this.repository.findBySlug(data.slug);
  if (existing) {
    throw new ConflictError('このスラッグは既に使用されています');
  }

  // 作成処理...
}
```

---

## トランザクション整合性

### 重要操作のトランザクション

以下の操作はトランザクションで実行し、途中失敗時はロールバックする：

| 操作 | 対象テーブル |
|------|-------------|
| 組織作成 | Organization, OrganizationMember |
| 招待承諾 | OrganizationMember, OrganizationInvitation |
| オーナー移譲 | OrganizationMember (2レコード) |

### トランザクション例

```typescript
await prisma.$transaction(async (tx) => {
  // 複数のDB操作
  await tx.organizationMember.update({ ... });
  await tx.organizationMember.update({ ... });

  // いずれかが失敗した場合、全操作がロールバック
});
```

---

## セキュリティ上の注意事項

### 招待トークン

- URL パラメータとして使用されるため、アクセスログに記録される可能性
- 有効期限（7日）を短く設定して露出リスクを軽減
- 使用済み・期限切れトークンは再利用不可

### 権限昇格の防止

- ADMIN は自身を OWNER に昇格不可（transferOwnership は OWNER のみ）
- ロール変更は上位ロールのみ可能

### OWNER 保護

- OWNER はロール変更不可（降格防止）
- OWNER は組織から削除不可
- OWNER 移譲時は現 OWNER の確認が必要

### 削除済み組織

- 通常の API からはアクセス不可（論理的に存在しない扱い）
- 復元のみ特別に許可（OWNER 限定）
- 猶予期間後は物理削除を検討（未実装）
