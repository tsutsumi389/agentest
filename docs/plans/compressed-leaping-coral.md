# プロジェクトオーナーをProjectMemberに登録する仕様変更

## 概要
プロジェクトオーナーを `ProjectMember` テーブルに `OWNER` ロールで登録し、権限管理を統一する。

## 変更方針
- `Project.ownerId` は**削除する**
- `ProjectMember` テーブルにオーナーを `OWNER` ロールで登録
- **組織プロジェクトでも作成者を `OWNER` として登録**
- 権限チェックは `ProjectMember.role` で統一

---

## 実装ステップ

### Step 1: スキーマ・型定義の更新

**packages/db/prisma/schema.prisma** (30-34行目)
```prisma
enum ProjectRole {
  OWNER   // 追加
  ADMIN
  WRITE
  READ
}
```

**packages/db/prisma/schema.prisma** (Projectモデル, 337行目)
```prisma
// 以下を削除
ownerId        String?   @map("owner_id")
owner          User?     @relation("ProjectOwner", fields: [ownerId], references: [id])
@@index([ownerId])
```

**packages/shared/src/types/enums.ts** (22-27行目)
```typescript
export const ProjectRole = {
  OWNER: 'OWNER',  // 追加
  ADMIN: 'ADMIN',
  WRITE: 'WRITE',
  READ: 'READ',
} as const;
```

**実行**: `docker compose exec dev pnpm db:generate`

---

### Step 2: テストヘルパーの更新

**apps/api/src/__tests__/integration/test-helpers.ts**

`createTestProject()` を更新（トランザクションでオーナーメンバーも作成）:
```typescript
export async function createTestProject(ownerId: string, overrides = {}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ ... });
    await tx.projectMember.create({
      data: { projectId: project.id, userId: ownerId, role: 'OWNER' },
    });
    return project;
  });
}
```

`createTestProjectMember()` のrole型に `'OWNER'` を追加

---

### Step 3: サービス層の更新

**apps/api/src/services/project.service.ts**

| メソッド | 変更内容 |
|---------|---------|
| `create()` | `ownerId` 設定を削除、トランザクションでオーナーを `ProjectMember` に登録（組織PJも含む） |
| `getMembers()` | 仮想オーナー処理を削除（112-132行目のブロック全体削除） |
| `removeMember()` | `project.ownerId` → `member.role === 'OWNER'` でチェック |
| `updateMemberRole()` | OWNER への/からの変更を禁止するガードを追加 |
| `createHistory()` | snapshotから `ownerId` を削除 |

```typescript
// create() の変更例
async create(userId: string, data: { ... }) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
        // ownerId は削除
      },
    });
    // 全てのプロジェクトで作成者をOWNERとして登録
    await tx.projectMember.create({
      data: { projectId: project.id, userId, role: 'OWNER' },
    });
    return project;
  });
}
```

---

### Step 4: ミドルウェアの更新

**apps/api/src/middleware/require-test-suite-role.ts** (75-87行目)

```typescript
// 変更前
if (project.ownerId === user.id) { ... }

// 変更後
const member = project.members[0];
if (member?.role === 'OWNER') { ... }
```

**packages/auth/src/middleware.ts** (requireProjectRole, 192-199行目)

同様に `project.ownerId` → `member.role === 'OWNER'` に変更

---

### Step 5: UserServiceの更新

**apps/api/src/services/user.service.ts** (147-153行目)

```typescript
// 変更前
const role = p.ownerId === userId ? 'OWNER' : members[0]?.role ?? 'READ';

// 変更後
const role = members[0]?.role ?? 'READ';
```

---

### Step 6: データマイグレーション（実行順序重要）

**Step 6a: 既存データの移行スクリプト実行**

**packages/db/scripts/migrate-project-owners.ts** (新規作成)

既存プロジェクトのオーナーを `ProjectMember` に登録するスクリプト:
```typescript
// ownerId カラム削除前に実行すること！
const projects = await prisma.project.findMany({
  where: { ownerId: { not: null } },  // 削除済みも含む
});
await prisma.$transaction(
  projects.map((p) => prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: p.id, userId: p.ownerId! } },
    create: { projectId: p.id, userId: p.ownerId!, role: 'OWNER' },
    update: { role: 'OWNER' },
  }))
);
```

**Step 6b: ownerId カラムの削除**

マイグレーションスクリプト実行後、Prisma マイグレーションを実行:
```bash
docker compose exec dev pnpm db:migrate
```

これにより `owner_id` カラムが削除される。

---

### Step 7: フロントエンドの更新

**apps/web/src/lib/api.ts** (Project型定義)
- `ownerId` と `owner` プロパティを削除

**apps/web/src/pages/ProjectDetail.tsx** (63-70行目)
- `project.ownerId === user.id` チェックを削除
- `membersData.members` からロールを取得

**apps/web/src/pages/ProjectSettings.tsx** (70-97行目)
- 同様に `ownerId` チェックを削除

**apps/web/src/components/project/ProjectMemberList.tsx** (375-408行目)
- オーナー表示の特別処理ブロックを削除（メンバー一覧に含まれるため）
- `project.owner` 参照を削除

---

### Step 8: テストの更新

統合テストで `setTestAuth` のモックを `'OWNER'` ロールに対応させる

---

## 重要ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | OWNER enum追加、ownerId削除 |
| `packages/shared/src/types/enums.ts` | OWNER追加 |
| `apps/api/src/services/project.service.ts` | create, getMembers, removeMember, updateMemberRole, createHistory |
| `apps/api/src/middleware/require-test-suite-role.ts` | 権限チェックロジック |
| `packages/auth/src/middleware.ts` | requireProjectRole |
| `apps/api/src/services/user.service.ts` | getProjects |
| `apps/api/src/__tests__/integration/test-helpers.ts` | createTestProject, createTestProjectMember |
| `apps/web/src/lib/api.ts` | Project型からownerId削除 |
| `apps/web/src/pages/ProjectDetail.tsx` | ロール判定 |
| `apps/web/src/pages/ProjectSettings.tsx` | ロール判定 |
| `apps/web/src/components/project/ProjectMemberList.tsx` | オーナー表示削除 |
| `packages/db/scripts/migrate-project-owners.ts` | 新規作成 |

---

## 注意事項

1. **OWNERロールの保護**
   - APIからの直接追加禁止（addMemberSchemaにOWNERを含めない）
   - 削除不可
   - ロール変更不可

2. **トランザクション必須**: プロジェクト作成とオーナーメンバー登録は同一トランザクション

3. **マイグレーション順序が重要**:
   - Step 6a: 既存データ移行スクリプト実行（ownerId削除前に！）
   - Step 6b: Prismaマイグレーション実行（ownerIdカラム削除）

4. **組織プロジェクトも対象**: 全てのプロジェクトで作成者をOWNERとして登録
