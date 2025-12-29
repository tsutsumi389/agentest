# テストケース認可チェックミドルウェアの追加

## 概要

テストケースAPIに対するアクセス権限チェックを追加する。
現状、テストケースIDが分かれば誰でもデータを操作可能な状態のため、
プロジェクトメンバーシップに基づく認可チェックを実装する。

## 現状の問題

| エンドポイント | 認証 | 認可 |
|---------------|------|------|
| `/api/test-cases/:testCaseId` | ✅ requireAuth | ❌ なし |
| `/api/test-cases/:testCaseId/preconditions/*` | ✅ requireAuth | ❌ なし |
| `/api/test-cases/:testCaseId/steps/*` | ✅ requireAuth | ❌ なし |
| `/api/test-cases/:testCaseId/expected-results/*` | ✅ requireAuth | ❌ なし |

## 解決方針

`requireTestSuiteRole`ミドルウェアを参考に、`requireTestCaseRole`ミドルウェアを作成する。
テストケース → テストスイート → プロジェクト の階層をたどり、プロジェクトメンバーシップを検証する。

---

## 実装タスク

### Task 1: requireTestCaseRoleミドルウェアの作成

**ファイル**: `apps/api/src/middleware/require-test-case-role.ts`

**参照実装**: `apps/api/src/middleware/require-test-suite-role.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, type ProjectRole } from '@agentest/db';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@agentest/shared';

const testCaseIdSchema = z.string().uuid();

export interface RequireTestCaseRoleOptions {
  /**
   * 削除済みテストケースへの操作を許可するか（デフォルト: false）
   */
  allowDeletedCase?: boolean;
}

/**
 * テストケース権限チェックミドルウェア
 * テストケースID → テストスイート → プロジェクト の階層をたどり、プロジェクト権限をチェック
 */
export function requireTestCaseRole(roles: ProjectRole[], options: RequireTestCaseRoleOptions = {}) {
  const { allowDeletedCase = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const user = req.user as { id: string };
      const testCaseId = req.params.testCaseId;

      if (!testCaseId) {
        throw new AuthorizationError('Test case ID required');
      }

      // UUID形式のバリデーション
      const parseResult = testCaseIdSchema.safeParse(testCaseId);
      if (!parseResult.success) {
        throw new BadRequestError('Invalid test case ID format');
      }

      // テストケース → テストスイート → プロジェクト情報を取得
      const testCase = await prisma.testCase.findUnique({
        where: { id: testCaseId },
        include: {
          testSuite: {
            include: {
              project: {
                include: {
                  members: {
                    where: { userId: user.id },
                  },
                },
              },
            },
          },
        },
      });

      if (!testCase) {
        throw new NotFoundError('TestCase', testCaseId);
      }

      // 削除済みテストケースのチェック
      if (testCase.deletedAt && !allowDeletedCase) {
        throw new NotFoundError('TestCase', testCaseId);
      }

      const testSuite = testCase.testSuite;

      // 削除済みテストスイートのチェック
      if (testSuite.deletedAt) {
        throw new AuthorizationError('Test suite has been deleted');
      }

      const project = testSuite.project;

      // 削除済みプロジェクトのチェック
      if (project.deletedAt) {
        throw new AuthorizationError('Project has been deleted');
      }

      // プロジェクトメンバーシップをチェック
      const member = project.members[0];
      if (member) {
        if (member.role === 'OWNER') {
          req.params.projectId = project.id;
          req.params.testSuiteId = testSuite.id;
          return next();
        }
        if (roles.includes(member.role)) {
          req.params.projectId = project.id;
          req.params.testSuiteId = testSuite.id;
          return next();
        }
      }

      // プロジェクトが組織に属する場合、組織メンバーシップをチェック
      if (project.organizationId) {
        const orgMember = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: project.organizationId,
              userId: user.id,
            },
          },
        });

        if (orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role)) {
          req.params.projectId = project.id;
          req.params.testSuiteId = testSuite.id;
          return next();
        }
      }

      throw new AuthorizationError('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}
```

### Task 2: ルート定義の更新

**ファイル**: `apps/api/src/routes/test-cases.ts`

変更内容:
- `requireAuth`を`requireTestCaseRole`に置き換え
- 読み取り操作: `['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']`
- 書き込み操作: `['OWNER', 'ADMIN', 'MEMBER']`

```typescript
import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { TestCaseController } from '../controllers/test-case.controller.js';
import { requireTestCaseRole } from '../middleware/require-test-case-role.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const testCaseController = new TestCaseController();

// 読み取り権限（VIEWER以上）
const readRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
// 書き込み権限（MEMBER以上）
const writeRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const;

// テストケース作成は別途testSuiteIdが必要なため、コントローラー内で検証
router.post('/', requireAuth(authConfig), testCaseController.create);

// 読み取り操作
router.get('/:testCaseId', requireTestCaseRole([...readRoles]), testCaseController.getById);
router.get('/:testCaseId/preconditions', requireTestCaseRole([...readRoles]), testCaseController.getPreconditions);
router.get('/:testCaseId/steps', requireTestCaseRole([...readRoles]), testCaseController.getSteps);
router.get('/:testCaseId/expected-results', requireTestCaseRole([...readRoles]), testCaseController.getExpectedResults);

// 書き込み操作
router.patch('/:testCaseId', requireTestCaseRole([...writeRoles]), testCaseController.update);
router.delete('/:testCaseId', requireTestCaseRole([...writeRoles]), testCaseController.delete);

// 前提条件
router.post('/:testCaseId/preconditions', requireTestCaseRole([...writeRoles]), testCaseController.addPrecondition);
router.post('/:testCaseId/preconditions/reorder', requireTestCaseRole([...writeRoles]), testCaseController.reorderPreconditions);
router.patch('/:testCaseId/preconditions/:preconditionId', requireTestCaseRole([...writeRoles]), testCaseController.updatePrecondition);
router.delete('/:testCaseId/preconditions/:preconditionId', requireTestCaseRole([...writeRoles]), testCaseController.deletePrecondition);

// ステップ
router.post('/:testCaseId/steps', requireTestCaseRole([...writeRoles]), testCaseController.addStep);
router.post('/:testCaseId/steps/reorder', requireTestCaseRole([...writeRoles]), testCaseController.reorderSteps);
router.patch('/:testCaseId/steps/:stepId', requireTestCaseRole([...writeRoles]), testCaseController.updateStep);
router.delete('/:testCaseId/steps/:stepId', requireTestCaseRole([...writeRoles]), testCaseController.deleteStep);

// 期待結果
router.post('/:testCaseId/expected-results', requireTestCaseRole([...writeRoles]), testCaseController.addExpectedResult);
router.post('/:testCaseId/expected-results/reorder', requireTestCaseRole([...writeRoles]), testCaseController.reorderExpectedResults);
router.patch('/:testCaseId/expected-results/:expectedResultId', requireTestCaseRole([...writeRoles]), testCaseController.updateExpectedResult);
router.delete('/:testCaseId/expected-results/:expectedResultId', requireTestCaseRole([...writeRoles]), testCaseController.deleteExpectedResult);

export default router;
```

### Task 3: テストケース作成時の認可チェック

**ファイル**: `apps/api/src/services/test-case.service.ts`

テストケース作成時は`testSuiteId`をリクエストボディで受け取るため、
サービス層でプロジェクトメンバーシップを検証する。

```typescript
async create(
  userId: string,
  data: {
    testSuiteId: string;
    title: string;
    description?: string;
    priority?: TestCasePriority;
    status?: EntityStatus;
  }
) {
  // テストスイートの存在確認とプロジェクトメンバーシップ検証
  const testSuite = await prisma.testSuite.findUnique({
    where: { id: data.testSuiteId },
    include: {
      project: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!testSuite || testSuite.deletedAt) {
    throw new NotFoundError('TestSuite', data.testSuiteId);
  }

  // プロジェクトメンバーシップチェック
  const member = testSuite.project.members[0];
  if (!member || !['OWNER', 'ADMIN', 'MEMBER'].includes(member.role)) {
    // 組織メンバーシップもチェック
    if (testSuite.project.organizationId) {
      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: testSuite.project.organizationId,
            userId,
          },
        },
      });
      if (!orgMember || !['OWNER', 'ADMIN'].includes(orgMember.role)) {
        throw new AuthorizationError('Insufficient permissions');
      }
    } else {
      throw new AuthorizationError('Insufficient permissions');
    }
  }

  // 以下、既存の作成処理...
}
```

### Task 4: ユニットテストの作成

**ファイル**: `apps/api/src/__tests__/unit/require-test-case-role.middleware.test.ts`

**参照実装**: `apps/api/src/__tests__/unit/require-test-suite-role.middleware.test.ts`

テストケース:
1. 認証されていないユーザーのリクエストを拒否
2. 無効なテストケースIDでエラーを返す
3. 存在しないテストケースで404エラーを返す
4. 削除済みテストケースで404エラーを返す
5. プロジェクトメンバーでないユーザーを拒否
6. VIEWERロールで書き込み操作を拒否
7. MEMBERロールで書き込み操作を許可
8. OWNERロールで全操作を許可
9. 組織OWNER/ADMINで操作を許可

### Task 5: 結合テストの作成

**ファイル**: `apps/api/src/__tests__/integration/test-case-authorization.integration.test.ts`

テストケース:
1. 認可なしでテストケース詳細取得を拒否
2. VIEWERで読み取り操作を許可
3. VIEWERで書き込み操作を拒否
4. MEMBERで書き込み操作を許可
5. 他プロジェクトのテストケースへのアクセスを拒否

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/middleware/require-test-case-role.ts` | 新規作成 |
| `apps/api/src/routes/test-cases.ts` | ミドルウェア置き換え |
| `apps/api/src/services/test-case.service.ts` | create時の認可チェック追加 |
| `apps/api/src/__tests__/unit/require-test-case-role.middleware.test.ts` | 新規作成 |
| `apps/api/src/__tests__/integration/test-case-authorization.integration.test.ts` | 新規作成 |

---

## 実装順序

1. Task 1: ミドルウェア作成
2. Task 4: ユニットテスト作成
3. Task 2: ルート定義更新
4. Task 3: サービス層の認可チェック追加
5. Task 5: 結合テスト作成

---

## テスト観点

- 認証されていないリクエストの拒否
- 無効なUUID形式のエラーハンドリング
- 存在しないリソースへのアクセス
- 削除済みリソースへのアクセス
- ロールベースのアクセス制御（VIEWER/MEMBER/ADMIN/OWNER）
- 組織メンバーシップによるアクセス許可
- 他プロジェクトのリソースへのアクセス拒否
