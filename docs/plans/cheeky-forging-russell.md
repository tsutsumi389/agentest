# 組織プラン「契約なし」状態の追加

## 概要

TEAMプラン契約前の組織に「契約なし」状態を追加し、プロジェクト作成を制限する。

## 現状

- 組織プラン: `TEAM`, `ENTERPRISE` のみ（デフォルト: `TEAM`）
- 組織作成時に自動的に`TEAM`が設定される
- プロジェクト作成時のプランチェックなし

## 変更内容

### 1. OrganizationPlan enumに「NONE」を追加

```prisma
enum OrganizationPlan {
  NONE        // 新規追加: 契約なし
  TEAM
  ENTERPRISE
}
```

### 2. 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | enum定義 + デフォルト値変更 |
| `packages/shared/src/types/enums.ts` | TypeScript enum追加 |
| `packages/shared/src/config/plan-pricing.ts` | `OrgPlan`型 + `ORG_PLAN_LIMITS`追加 |
| `apps/api/src/services/project.service.ts` | プランチェック実装 |
| `apps/admin/src/components/**` | バッジ表示対応 |

### 3. プランチェック実装（project.service.ts）

```typescript
async create(userId: string, data: { name: string; ... }) {
  if (data.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: data.organizationId },
      select: { plan: true },
    });

    // 契約なしプランはプロジェクト作成不可
    if (org?.plan === 'NONE') {
      throw new BusinessError(
        'PLAN_REQUIRED',
        'プロジェクトを作成するにはプランの契約が必要です'
      );
    }
  }
  // 既存の作成ロジック
}
```

### 4. NONEプランの制限値

```typescript
ORG_PLAN_LIMITS.NONE = {
  maxProjects: 0,
  maxTestCases: 0,
  changeHistoryDays: 0,
};
```

## 実装手順

1. **DBスキーマ更新**
   - `packages/db/prisma/schema.prisma` にNONE追加
   - デフォルト値を`NONE`に変更
   - マイグレーション実行

2. **shared更新**
   - `enums.ts` に`NONE`追加
   - `plan-pricing.ts` に制限値追加

3. **APIロジック追加**
   - `project.service.ts` にプランチェック追加

4. **フロントエンド対応**
   - 管理画面のバッジ表示対応

## 検証方法

1. NONEプランの組織でプロジェクト作成 → エラー
2. TEAMプランの組織でプロジェクト作成 → 成功
3. 個人プロジェクト（organizationId=null）→ 成功
