import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  paginationSchema,
  sortSchema,
  userCreateSchema,
  userUpdateSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  organizationInviteSchema,
  projectCreateSchema,
  projectUpdateSchema,
  projectEnvironmentSchema,
  projectEnvironmentCreateSchema,
  projectEnvironmentUpdateSchema,
  projectEnvironmentReorderSchema,
  testCaseReorderSchema,
  testSuiteCreateSchema,
  testSuiteUpdateSchema,
  testCaseCreateSchema,
  testCaseUpdateSchema,
  executionCreateSchema,
  executionResultUpdateSchema,
  testSuiteSearchSchema,
  testCaseSearchSchema,
  executionSearchSchema,
  suggestionSearchSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
  reviewSubmitSchema,
  reviewSearchSchema,
  reviewCommentCreateSchema,
  reviewCommentUpdateSchema,
  reviewStatusUpdateSchema,
  reviewVerdictUpdateSchema,
  reviewReplyCreateSchema,
  reviewCommentSearchSchema,
  labelCreateSchema,
  labelUpdateSchema,
  testSuiteLabelsUpdateSchema,
  auditLogExportSchema,
  adminUserSearchSchema,
  adminOrganizationSearchSchema,
  adminAuditLogSearchSchema,
  activeUserMetricsQuerySchema,
  planDistributionQuerySchema,
  systemAdminSearchSchema,
  systemAdminInviteSchema,
  systemAdminUpdateSchema,
  acceptInvitationSchema,
  userPlanSchema,
  organizationPlanSchema,
  organizationRoleSchema,
  projectRoleSchema,
  entityStatusSchema,
  testCasePrioritySchema,
  preconditionStatusSchema,
  stepStatusSchema,
  judgmentStatusSchema,
} from './schemas.js';

describe('共通スキーマ', () => {
  describe('uuidSchema', () => {
    it('有効なUUIDを受け入れる', () => {
      const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
      expect(result.success).toBe(true);
    });

    it('無効なUUIDを拒否する', () => {
      expect(uuidSchema.safeParse('invalid').success).toBe(false);
      expect(uuidSchema.safeParse('').success).toBe(false);
      expect(uuidSchema.safeParse('123').success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('有効な値を受け入れる', () => {
      const result = paginationSchema.parse({ page: 2, limit: 50 });
      expect(result).toEqual({ page: 2, limit: 50 });
    });

    it('文字列を数値に変換する', () => {
      const result = paginationSchema.parse({ page: '3', limit: '30' });
      expect(result).toEqual({ page: 3, limit: 30 });
    });

    it('pageの最小値は1', () => {
      expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
      expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false);
    });

    it('limitの範囲は1-100', () => {
      expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
      expect(paginationSchema.safeParse({ limit: 100 }).success).toBe(true);
    });
  });

  describe('sortSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = sortSchema.parse({});
      expect(result).toEqual({ sortOrder: 'desc' });
    });

    it('sortByとsortOrderを受け入れる', () => {
      const result = sortSchema.parse({ sortBy: 'name', sortOrder: 'asc' });
      expect(result).toEqual({ sortBy: 'name', sortOrder: 'asc' });
    });

    it('無効なsortOrderを拒否する', () => {
      expect(sortSchema.safeParse({ sortOrder: 'invalid' }).success).toBe(false);
    });
  });
});

describe('Enumスキーマ', () => {
  describe('userPlanSchema', () => {
    it('FREEとPROを受け入れる', () => {
      expect(userPlanSchema.safeParse('FREE').success).toBe(true);
      expect(userPlanSchema.safeParse('PRO').success).toBe(true);
    });

    it('無効な値を拒否する', () => {
      expect(userPlanSchema.safeParse('INVALID').success).toBe(false);
    });
  });

  describe('organizationPlanSchema', () => {
    it('TEAMとENTERPRISEを受け入れる', () => {
      expect(organizationPlanSchema.safeParse('TEAM').success).toBe(true);
      expect(organizationPlanSchema.safeParse('ENTERPRISE').success).toBe(true);
    });
  });

  describe('organizationRoleSchema', () => {
    it('OWNER, ADMIN, MEMBERを受け入れる', () => {
      expect(organizationRoleSchema.safeParse('OWNER').success).toBe(true);
      expect(organizationRoleSchema.safeParse('ADMIN').success).toBe(true);
      expect(organizationRoleSchema.safeParse('MEMBER').success).toBe(true);
    });
  });

  describe('projectRoleSchema', () => {
    it('ADMIN, WRITE, READを受け入れる', () => {
      expect(projectRoleSchema.safeParse('ADMIN').success).toBe(true);
      expect(projectRoleSchema.safeParse('WRITE').success).toBe(true);
      expect(projectRoleSchema.safeParse('READ').success).toBe(true);
    });
  });

  describe('entityStatusSchema', () => {
    it('DRAFT, ACTIVE, ARCHIVEDを受け入れる', () => {
      expect(entityStatusSchema.safeParse('DRAFT').success).toBe(true);
      expect(entityStatusSchema.safeParse('ACTIVE').success).toBe(true);
      expect(entityStatusSchema.safeParse('ARCHIVED').success).toBe(true);
    });
  });

  describe('testCasePrioritySchema', () => {
    it('全ての優先度を受け入れる', () => {
      expect(testCasePrioritySchema.safeParse('CRITICAL').success).toBe(true);
      expect(testCasePrioritySchema.safeParse('HIGH').success).toBe(true);
      expect(testCasePrioritySchema.safeParse('MEDIUM').success).toBe(true);
      expect(testCasePrioritySchema.safeParse('LOW').success).toBe(true);
    });
  });

  describe('preconditionStatusSchema', () => {
    it('全てのステータスを受け入れる', () => {
      expect(preconditionStatusSchema.safeParse('UNCHECKED').success).toBe(true);
      expect(preconditionStatusSchema.safeParse('MET').success).toBe(true);
      expect(preconditionStatusSchema.safeParse('NOT_MET').success).toBe(true);
    });
  });

  describe('stepStatusSchema', () => {
    it('全てのステータスを受け入れる', () => {
      expect(stepStatusSchema.safeParse('PENDING').success).toBe(true);
      expect(stepStatusSchema.safeParse('DONE').success).toBe(true);
      expect(stepStatusSchema.safeParse('SKIPPED').success).toBe(true);
    });
  });

  describe('judgmentStatusSchema', () => {
    it('全てのステータスを受け入れる', () => {
      expect(judgmentStatusSchema.safeParse('PENDING').success).toBe(true);
      expect(judgmentStatusSchema.safeParse('PASS').success).toBe(true);
      expect(judgmentStatusSchema.safeParse('FAIL').success).toBe(true);
      expect(judgmentStatusSchema.safeParse('SKIPPED').success).toBe(true);
    });
  });
});

describe('ユーザースキーマ', () => {
  describe('userCreateSchema', () => {
    it('有効なユーザー情報を受け入れる', () => {
      const result = userCreateSchema.safeParse({
        email: 'test@example.com',
        name: 'テストユーザー',
      });
      expect(result.success).toBe(true);
    });

    it('avatarUrlを含められる', () => {
      const result = userCreateSchema.safeParse({
        email: 'test@example.com',
        name: 'テストユーザー',
        avatarUrl: 'https://example.com/avatar.png',
      });
      expect(result.success).toBe(true);
    });

    it('無効なメールアドレスを拒否する', () => {
      const result = userCreateSchema.safeParse({
        email: 'invalid-email',
        name: 'テストユーザー',
      });
      expect(result.success).toBe(false);
    });

    it('空の名前を拒否する', () => {
      const result = userCreateSchema.safeParse({
        email: 'test@example.com',
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('メールアドレスの最大長は255文字', () => {
      // 256文字のメールアドレス（255文字を超える）
      const longEmail = 'a'.repeat(247) + '@test.com';
      expect(userCreateSchema.safeParse({ email: longEmail, name: 'test' }).success).toBe(false);
    });

    it('名前の最大長は100文字', () => {
      const longName = 'a'.repeat(101);
      expect(userCreateSchema.safeParse({ email: 'test@example.com', name: longName }).success).toBe(false);
    });
  });

  describe('userUpdateSchema', () => {
    it('部分的な更新を受け入れる', () => {
      expect(userUpdateSchema.safeParse({ name: '新しい名前' }).success).toBe(true);
      expect(userUpdateSchema.safeParse({ avatarUrl: 'https://example.com/new.png' }).success).toBe(true);
      expect(userUpdateSchema.safeParse({}).success).toBe(true);
    });

    it('avatarUrlをnullで上書きできる', () => {
      const result = userUpdateSchema.safeParse({ avatarUrl: null });
      expect(result.success).toBe(true);
    });
  });
});

describe('組織スキーマ', () => {
  describe('organizationCreateSchema', () => {
    it('有効な組織情報を受け入れる', () => {
      const result = organizationCreateSchema.safeParse({
        name: 'テスト組織',
      });
      expect(result.success).toBe(true);
    });

    it('descriptionとbillingEmailを含められる', () => {
      const result = organizationCreateSchema.safeParse({
        name: 'テスト組織',
        description: 'テスト用の組織です',
        billingEmail: 'billing@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('空の名前を拒否する', () => {
      expect(organizationCreateSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('descriptionの最大長は500文字', () => {
      const longDesc = 'a'.repeat(501);
      expect(organizationCreateSchema.safeParse({ name: 'test', description: longDesc }).success).toBe(false);
    });
  });

  describe('organizationInviteSchema', () => {
    it('ADMINとMEMBERロールを受け入れる', () => {
      expect(organizationInviteSchema.safeParse({ email: 'test@example.com', role: 'ADMIN' }).success).toBe(true);
      expect(organizationInviteSchema.safeParse({ email: 'test@example.com', role: 'MEMBER' }).success).toBe(true);
    });

    it('OWNERロールを拒否する', () => {
      expect(organizationInviteSchema.safeParse({ email: 'test@example.com', role: 'OWNER' }).success).toBe(false);
    });
  });
});

describe('プロジェクトスキーマ', () => {
  describe('projectCreateSchema', () => {
    it('有効なプロジェクト情報を受け入れる', () => {
      const result = projectCreateSchema.safeParse({
        name: 'テストプロジェクト',
      });
      expect(result.success).toBe(true);
    });

    it('organizationIdを含められる', () => {
      const result = projectCreateSchema.safeParse({
        name: 'テストプロジェクト',
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('projectEnvironmentSchema', () => {
    it('有効な環境情報を受け入れる', () => {
      const result = projectEnvironmentSchema.safeParse({
        name: 'Production',
        baseUrl: 'https://api.example.com',
        isDefault: true,
      });
      expect(result.success).toBe(true);
    });

    it('isDefaultのデフォルト値はfalse', () => {
      const result = projectEnvironmentSchema.parse({ name: 'Staging' });
      expect(result.isDefault).toBe(false);
    });
  });

  describe('projectEnvironmentReorderSchema', () => {
    it('UUID配列を受け入れる', () => {
      const result = projectEnvironmentReorderSchema.safeParse({
        environmentIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ],
      });
      expect(result.success).toBe(true);
    });

    it('空の配列を拒否する', () => {
      expect(projectEnvironmentReorderSchema.safeParse({ environmentIds: [] }).success).toBe(false);
    });
  });
});

describe('テストスイートスキーマ', () => {
  describe('testSuiteCreateSchema', () => {
    it('有効なテストスイート情報を受け入れる', () => {
      const result = testSuiteCreateSchema.safeParse({
        name: 'ログイン機能テスト',
      });
      expect(result.success).toBe(true);
    });

    it('statusのデフォルト値はDRAFT', () => {
      const result = testSuiteCreateSchema.parse({ name: 'テスト' });
      expect(result.status).toBe('DRAFT');
    });

    it('前提条件を含められる', () => {
      const result = testSuiteCreateSchema.safeParse({
        name: 'テスト',
        preconditions: [
          { content: 'ユーザーがログインしていること' },
          { content: '管理者権限を持っていること' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('名前の最大長は200文字', () => {
      const longName = 'a'.repeat(201);
      expect(testSuiteCreateSchema.safeParse({ name: longName }).success).toBe(false);
    });

    it('descriptionの最大長は2000文字', () => {
      const longDesc = 'a'.repeat(2001);
      expect(testSuiteCreateSchema.safeParse({ name: 'test', description: longDesc }).success).toBe(false);
    });
  });

  describe('testSuiteSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = testSuiteSearchSchema.parse({});
      expect(result).toEqual({
        status: 'ACTIVE',
        limit: 20,
        offset: 0,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        includeDeleted: false,
      });
    });

    it('labelIdsをカンマ区切りから配列に変換する', () => {
      const result = testSuiteSearchSchema.parse({
        labelIds: '550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.labelIds).toEqual([
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]);
    });

    it('空白を含むlabelIdsも正しく処理する', () => {
      const result = testSuiteSearchSchema.parse({
        labelIds: '550e8400-e29b-41d4-a716-446655440000, 550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.labelIds).toEqual([
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]);
    });
  });
});

describe('テストケーススキーマ', () => {
  describe('testCaseCreateSchema', () => {
    it('有効なテストケース情報を受け入れる', () => {
      const result = testCaseCreateSchema.safeParse({
        title: 'ログインボタンをクリックする',
      });
      expect(result.success).toBe(true);
    });

    it('デフォルト値を適用する', () => {
      const result = testCaseCreateSchema.parse({ title: 'テスト' });
      expect(result.priority).toBe('MEDIUM');
      expect(result.status).toBe('DRAFT');
    });

    it('前提条件、ステップ、期待結果を含められる', () => {
      const result = testCaseCreateSchema.safeParse({
        title: 'ログインテスト',
        preconditions: [{ content: 'ログイン画面が表示されている' }],
        steps: [
          { content: 'メールアドレスを入力する' },
          { content: 'パスワードを入力する' },
          { content: 'ログインボタンをクリックする' },
        ],
        expectedResults: [{ content: 'ダッシュボード画面が表示される' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('testCaseSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = testCaseSearchSchema.parse({});
      expect(result).toEqual({
        limit: 20,
        offset: 0,
        sortBy: 'orderKey',
        sortOrder: 'asc',
        includeDeleted: false,
      });
    });

    it('statusをカンマ区切りから配列に変換する', () => {
      const result = testCaseSearchSchema.parse({
        status: 'DRAFT,ACTIVE',
      });
      expect(result.status).toEqual(['DRAFT', 'ACTIVE']);
    });

    it('priorityをカンマ区切りから配列に変換する', () => {
      const result = testCaseSearchSchema.parse({
        priority: 'CRITICAL,HIGH',
      });
      expect(result.priority).toEqual(['CRITICAL', 'HIGH']);
    });
  });

  describe('testCaseReorderSchema', () => {
    it('UUID配列を受け入れる', () => {
      const result = testCaseReorderSchema.safeParse({
        testCaseIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('実行スキーマ', () => {
  describe('executionCreateSchema', () => {
    it('有効な実行情報を受け入れる', () => {
      const result = executionCreateSchema.safeParse({
        testSuiteId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('environmentIdを含められる', () => {
      const result = executionCreateSchema.safeParse({
        testSuiteId: '550e8400-e29b-41d4-a716-446655440000',
        environmentId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('executionResultUpdateSchema', () => {
    it('前提条件ステータスを受け入れる', () => {
      expect(executionResultUpdateSchema.safeParse({ status: 'MET' }).success).toBe(true);
      expect(executionResultUpdateSchema.safeParse({ status: 'NOT_MET' }).success).toBe(true);
    });

    it('ステップステータスを受け入れる', () => {
      expect(executionResultUpdateSchema.safeParse({ status: 'DONE' }).success).toBe(true);
      expect(executionResultUpdateSchema.safeParse({ status: 'SKIPPED' }).success).toBe(true);
    });

    it('判定ステータスを受け入れる', () => {
      expect(executionResultUpdateSchema.safeParse({ status: 'PASS' }).success).toBe(true);
      expect(executionResultUpdateSchema.safeParse({ status: 'FAIL' }).success).toBe(true);
    });

    it('noteを含められる', () => {
      const result = executionResultUpdateSchema.safeParse({
        status: 'FAIL',
        note: '期待結果と異なる動作',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('executionSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = executionSearchSchema.parse({});
      expect(result).toEqual({
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('日付範囲でフィルタできる', () => {
      const result = executionSearchSchema.safeParse({
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      });
      expect(result.success).toBe(true);
    });

    it('environmentIdに"none"を指定できる', () => {
      const result = executionSearchSchema.safeParse({
        environmentId: 'none',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('レビュースキーマ', () => {
  describe('reviewCreateSchema', () => {
    it('空のオブジェクトを受け入れる', () => {
      expect(reviewCreateSchema.safeParse({}).success).toBe(true);
    });

    it('summaryを含められる', () => {
      const result = reviewCreateSchema.safeParse({
        summary: 'テストケースのレビューを開始します',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('reviewSubmitSchema', () => {
    it('verdictが必須', () => {
      expect(reviewSubmitSchema.safeParse({}).success).toBe(false);
      expect(reviewSubmitSchema.safeParse({ verdict: 'APPROVED' }).success).toBe(true);
    });

    it('全てのverdictを受け入れる', () => {
      expect(reviewSubmitSchema.safeParse({ verdict: 'APPROVED' }).success).toBe(true);
      expect(reviewSubmitSchema.safeParse({ verdict: 'CHANGES_REQUESTED' }).success).toBe(true);
      expect(reviewSubmitSchema.safeParse({ verdict: 'COMMENT_ONLY' }).success).toBe(true);
    });
  });

  describe('reviewCommentCreateSchema', () => {
    it('有効なコメント情報を受け入れる', () => {
      const result = reviewCommentCreateSchema.safeParse({
        targetType: 'CASE',
        targetId: '550e8400-e29b-41d4-a716-446655440000',
        targetField: 'TITLE',
        content: 'タイトルをより具体的にしてください',
      });
      expect(result.success).toBe(true);
    });

    it('targetTypeはSUITEまたはCASE', () => {
      expect(reviewCommentCreateSchema.safeParse({
        targetType: 'SUITE',
        targetId: '550e8400-e29b-41d4-a716-446655440000',
        targetField: 'DESCRIPTION',
        content: 'コメント',
      }).success).toBe(true);
    });

    it('targetFieldの全ての値を受け入れる', () => {
      const baseComment = {
        targetType: 'CASE' as const,
        targetId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'コメント',
      };
      expect(reviewCommentCreateSchema.safeParse({ ...baseComment, targetField: 'TITLE' }).success).toBe(true);
      expect(reviewCommentCreateSchema.safeParse({ ...baseComment, targetField: 'DESCRIPTION' }).success).toBe(true);
      expect(reviewCommentCreateSchema.safeParse({ ...baseComment, targetField: 'PRECONDITION' }).success).toBe(true);
      expect(reviewCommentCreateSchema.safeParse({ ...baseComment, targetField: 'STEP' }).success).toBe(true);
      expect(reviewCommentCreateSchema.safeParse({ ...baseComment, targetField: 'EXPECTED_RESULT' }).success).toBe(true);
    });

    it('contentの最大長は2000文字', () => {
      const longContent = 'a'.repeat(2001);
      expect(reviewCommentCreateSchema.safeParse({
        targetType: 'CASE',
        targetId: '550e8400-e29b-41d4-a716-446655440000',
        targetField: 'TITLE',
        content: longContent,
      }).success).toBe(false);
    });
  });

  describe('reviewCommentSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = reviewCommentSearchSchema.parse({});
      expect(result).toEqual({
        status: 'ALL',
        limit: 50,
        offset: 0,
      });
    });

    it('statusフィルタを適用できる', () => {
      expect(reviewCommentSearchSchema.safeParse({ status: 'OPEN' }).success).toBe(true);
      expect(reviewCommentSearchSchema.safeParse({ status: 'RESOLVED' }).success).toBe(true);
    });
  });
});

describe('ラベルスキーマ', () => {
  describe('labelCreateSchema', () => {
    it('有効なラベル情報を受け入れる', () => {
      const result = labelCreateSchema.safeParse({
        name: 'バグ',
        color: '#FF5733',
      });
      expect(result.success).toBe(true);
    });

    it('descriptionを含められる', () => {
      const result = labelCreateSchema.safeParse({
        name: 'バグ',
        color: '#FF5733',
        description: 'バグ関連のテストケース',
      });
      expect(result.success).toBe(true);
    });

    it('無効な色フォーマットを拒否する', () => {
      expect(labelCreateSchema.safeParse({ name: 'test', color: 'red' }).success).toBe(false);
      expect(labelCreateSchema.safeParse({ name: 'test', color: '#FFF' }).success).toBe(false);
      expect(labelCreateSchema.safeParse({ name: 'test', color: '#GGGGGG' }).success).toBe(false);
    });

    it('有効な色フォーマットを受け入れる', () => {
      expect(labelCreateSchema.safeParse({ name: 'test', color: '#000000' }).success).toBe(true);
      expect(labelCreateSchema.safeParse({ name: 'test', color: '#FFFFFF' }).success).toBe(true);
      expect(labelCreateSchema.safeParse({ name: 'test', color: '#abcdef' }).success).toBe(true);
    });
  });

  describe('testSuiteLabelsUpdateSchema', () => {
    it('UUID配列を受け入れる', () => {
      const result = testSuiteLabelsUpdateSchema.safeParse({
        labelIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(result.success).toBe(true);
    });

    it('空の配列を受け入れる', () => {
      expect(testSuiteLabelsUpdateSchema.safeParse({ labelIds: [] }).success).toBe(true);
    });
  });
});

describe('監査ログエクスポートスキーマ', () => {
  describe('auditLogExportSchema', () => {
    it('有効なエクスポート設定を受け入れる', () => {
      const result = auditLogExportSchema.safeParse({
        format: 'csv',
      });
      expect(result.success).toBe(true);
    });

    it('formatはcsvまたはjson', () => {
      expect(auditLogExportSchema.safeParse({ format: 'csv' }).success).toBe(true);
      expect(auditLogExportSchema.safeParse({ format: 'json' }).success).toBe(true);
      expect(auditLogExportSchema.safeParse({ format: 'xml' }).success).toBe(false);
    });

    it('日付範囲でフィルタできる', () => {
      const result = auditLogExportSchema.safeParse({
        format: 'csv',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });
      expect(result.success).toBe(true);
    });

    it('startDateがendDateより後の場合は拒否する', () => {
      const result = auditLogExportSchema.safeParse({
        format: 'csv',
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01'),
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('管理者向けスキーマ', () => {
  describe('adminUserSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = adminUserSearchSchema.parse({});
      expect(result).toEqual({
        status: 'active',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('planをカンマ区切りから配列に変換する', () => {
      const result = adminUserSearchSchema.parse({
        plan: 'FREE,PRO',
      });
      expect(result.plan).toEqual(['FREE', 'PRO']);
    });
  });

  describe('adminOrganizationSearchSchema', () => {
    it('日付範囲の検証を行う', () => {
      const validResult = adminOrganizationSearchSchema.safeParse({
        createdFrom: '2024-01-01T00:00:00Z',
        createdTo: '2024-12-31T23:59:59Z',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = adminOrganizationSearchSchema.safeParse({
        createdFrom: '2024-12-31T00:00:00Z',
        createdTo: '2024-01-01T00:00:00Z',
      });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('adminAuditLogSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = adminAuditLogSearchSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.sortOrder).toBe('desc');
    });

    it('カテゴリをカンマ区切りから配列に変換する', () => {
      const result = adminAuditLogSearchSchema.parse({
        category: 'AUTH,USER,ORGANIZATION',
      });
      expect(result.category).toEqual(['AUTH', 'USER', 'ORGANIZATION']);
    });
  });
});

describe('メトリクスクエリスキーマ', () => {
  describe('activeUserMetricsQuerySchema', () => {
    it('デフォルト値を適用する', () => {
      const result = activeUserMetricsQuerySchema.parse({});
      expect(result.granularity).toBe('day');
      expect(result.timezone).toBe('Asia/Tokyo');
    });

    it('期間が365日を超える場合は拒否する', () => {
      const result = activeUserMetricsQuerySchema.safeParse({
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2024-12-31T00:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('無効なタイムゾーン形式を拒否する', () => {
      const result = activeUserMetricsQuerySchema.safeParse({
        timezone: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('planDistributionQuerySchema', () => {
    it('includeMembersを文字列からbooleanに変換する', () => {
      const result1 = planDistributionQuerySchema.parse({ includeMembers: 'true' });
      expect(result1.includeMembers).toBe(true);

      const result2 = planDistributionQuerySchema.parse({ includeMembers: 'false' });
      expect(result2.includeMembers).toBe(false);
    });

    it('viewの全ての値を受け入れる', () => {
      expect(planDistributionQuerySchema.safeParse({ view: 'combined' }).success).toBe(true);
      expect(planDistributionQuerySchema.safeParse({ view: 'users' }).success).toBe(true);
      expect(planDistributionQuerySchema.safeParse({ view: 'organizations' }).success).toBe(true);
    });
  });
});

describe('システム管理者スキーマ', () => {
  describe('systemAdminSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = systemAdminSearchSchema.parse({});
      expect(result.status).toBe('active');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('roleをカンマ区切りから配列に変換する', () => {
      const result = systemAdminSearchSchema.parse({
        role: 'SUPER_ADMIN,ADMIN',
      });
      expect(result.role).toEqual(['SUPER_ADMIN', 'ADMIN']);
    });

    it('totpEnabledを文字列からbooleanに変換する', () => {
      const result1 = systemAdminSearchSchema.parse({ totpEnabled: 'true' });
      expect(result1.totpEnabled).toBe(true);

      const result2 = systemAdminSearchSchema.parse({ totpEnabled: 'false' });
      expect(result2.totpEnabled).toBe(false);
    });
  });

  describe('systemAdminInviteSchema', () => {
    it('有効な招待情報を受け入れる', () => {
      const result = systemAdminInviteSchema.safeParse({
        email: 'admin@example.com',
        name: '管理者',
        role: 'ADMIN',
      });
      expect(result.success).toBe(true);
    });

    it('全てのロールを受け入れる', () => {
      expect(systemAdminInviteSchema.safeParse({
        email: 'admin@example.com',
        name: '管理者',
        role: 'SUPER_ADMIN',
      }).success).toBe(true);
      expect(systemAdminInviteSchema.safeParse({
        email: 'admin@example.com',
        name: '管理者',
        role: 'VIEWER',
      }).success).toBe(true);
    });
  });

  describe('acceptInvitationSchema', () => {
    it('有効なパスワードを受け入れる', () => {
      const result = acceptInvitationSchema.safeParse({
        password: 'Password1!',
      });
      expect(result.success).toBe(true);
    });

    it('8文字未満のパスワードを拒否する', () => {
      const result = acceptInvitationSchema.safeParse({
        password: 'Pass1!',
      });
      expect(result.success).toBe(false);
    });

    it('大文字がないパスワードを拒否する', () => {
      const result = acceptInvitationSchema.safeParse({
        password: 'password1!',
      });
      expect(result.success).toBe(false);
    });

    it('小文字がないパスワードを拒否する', () => {
      const result = acceptInvitationSchema.safeParse({
        password: 'PASSWORD1!',
      });
      expect(result.success).toBe(false);
    });

    it('数字がないパスワードを拒否する', () => {
      const result = acceptInvitationSchema.safeParse({
        password: 'Password!',
      });
      expect(result.success).toBe(false);
    });

    it('記号がないパスワードを拒否する', () => {
      const result = acceptInvitationSchema.safeParse({
        password: 'Password1',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('サジェストスキーマ', () => {
  describe('suggestionSearchSchema', () => {
    it('デフォルト値を適用する', () => {
      const result = suggestionSearchSchema.parse({});
      expect(result.limit).toBe(10);
    });

    it('limitの最大値は50', () => {
      expect(suggestionSearchSchema.safeParse({ limit: 50 }).success).toBe(true);
      expect(suggestionSearchSchema.safeParse({ limit: 51 }).success).toBe(false);
    });
  });
});
