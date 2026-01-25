# Organization.slug フィールド削除計画

## 概要

Organization モデルから `slug` フィールドを削除する。現在、すべてのAPIエンドポイントは `organizationId` (UUID) でルーティングされており、slug は UI表示と検索フィルタにのみ使用されている。

## 現状分析

### slugの使用箇所

| 箇所 | 使用目的 | 削除影響 |
|------|---------|---------|
| Prismaスキーマ | UNIQUE制約付きフィールド | 列削除 |
| organization.controller.ts | 作成時バリデーション | バリデーション削除 |
| organization.service.ts | 重複チェック、監査ログ | 処理削除 |
| organization.repository.ts | findBySlug()メソッド | メソッド削除（未使用） |
| CreateOrganizationModal.tsx | slug入力UI、自動生成 | UI削除 |
| OrganizationCard.tsx | `/{slug}` 表示 | 表示削除 |
| Organizations.tsx | 検索フィルタ | nameのみに変更 |
| MCPサーバー | レスポンス型 | 型定義から削除 |
| shared/types | Organization型 | 型定義から削除 |

### findBySlug() の使用状況

- `organization.repository.ts` で定義されているが、**本番コードでは未使用**
- テストコードでのみ使用

## 削除対象ファイル一覧

### 1. データベース
- `packages/db/prisma/schema.prisma` - slug フィールドと@@index削除

### 2. API (apps/api/)
- `src/controllers/organization.controller.ts` - slugバリデーション削除
- `src/services/organization.service.ts` - 重複チェック・監査ログからslug削除
- `src/repositories/organization.repository.ts` - findBySlug()メソッド削除

### 3. フロントエンド (apps/web/)
- `src/components/organization/CreateOrganizationModal.tsx` - slug入力UI削除
- `src/components/organization/OrganizationCard.tsx` - slug表示削除
- `src/pages/Organizations.tsx` - 検索フィルタからslug削除
- `src/lib/api.ts` - Organization型からslug削除

### 4. 共有パッケージ (packages/shared/)
- `src/types/organization.ts` - Organization, OrganizationPublic型からslug削除

### 5. MCPサーバー (apps/mcp-server/)
- `src/tools/get-project.ts` - organization.slug削除
- `src/tools/search-project.ts` - organization.slug削除

### 6. テストコード
- `apps/api/src/__tests__/unit/organization.service.test.ts`
- `apps/api/src/__tests__/unit/organization.repository.test.ts`
- `apps/api/src/__tests__/integration/organization-operations.integration.test.ts`

### 7. シードデータ
- `packages/db/prisma/seed.ts` - slug削除

## 実装手順

### Step 1: Prismaスキーマ更新
1. `packages/db/prisma/schema.prisma` から slug フィールドと @@index([slug]) を削除
2. マイグレーション生成: `pnpm prisma migrate dev --name remove_organization_slug`

### Step 2: 型定義更新
1. `packages/shared/src/types/organization.ts` から slug 削除
2. `apps/web/src/lib/api.ts` から slug 削除

### Step 3: API更新
1. `organization.controller.ts` - createOrgSchemaからslug削除
2. `organization.service.ts` - 重複チェックと監査ログからslug削除
3. `organization.repository.ts` - findBySlug()メソッド削除

### Step 4: フロントエンド更新
1. `CreateOrganizationModal.tsx` - slug入力フィールドと自動生成関数削除
2. `OrganizationCard.tsx` - slug表示削除
3. `Organizations.tsx` - 検索フィルタをnameのみに変更

### Step 5: MCPサーバー更新
1. `get-project.ts` - organization.slug削除
2. `search-project.ts` - organization.slug削除

### Step 6: テスト・シード更新
1. テストコードからslug関連を削除
2. seed.tsからslug削除

## 検証方法

```bash
# コンテナ内で実行
docker compose exec dev pnpm test
docker compose exec dev pnpm build
docker compose exec dev pnpm lint
```

### 手動検証
1. 組織作成フローでslug入力がないことを確認
2. 組織一覧でslug表示がないことを確認
3. 組織検索がnameのみで動作することを確認
4. MCPツールでorganization情報にslugが含まれないことを確認
