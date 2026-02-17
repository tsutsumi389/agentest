import { z } from 'zod';
import {
  OrganizationRole,
  ProjectRole,
  EntityStatus,
  TestCasePriority,
  PreconditionStatus,
  StepStatus,
  JudgmentStatus,
  ReviewSessionStatus,
  ReviewVerdict,
  AuditLogCategory,
} from '../types/enums.js';

// 共通スキーマ
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Enumスキーマ
export const organizationRoleSchema = z.enum([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.MEMBER,
]);
export const projectRoleSchema = z.enum([ProjectRole.ADMIN, ProjectRole.WRITE, ProjectRole.READ]);
export const entityStatusSchema = z.enum([
  EntityStatus.DRAFT,
  EntityStatus.ACTIVE,
  EntityStatus.ARCHIVED,
]);
export const testCasePrioritySchema = z.enum([
  TestCasePriority.CRITICAL,
  TestCasePriority.HIGH,
  TestCasePriority.MEDIUM,
  TestCasePriority.LOW,
]);
export const preconditionStatusSchema = z.enum([
  PreconditionStatus.UNCHECKED,
  PreconditionStatus.MET,
  PreconditionStatus.NOT_MET,
]);
export const stepStatusSchema = z.enum([StepStatus.PENDING, StepStatus.DONE, StepStatus.SKIPPED]);
export const judgmentStatusSchema = z.enum([
  JudgmentStatus.PENDING,
  JudgmentStatus.PASS,
  JudgmentStatus.FAIL,
  JudgmentStatus.SKIPPED,
]);

// パスワード共通バリデーション
// パスワード要件: 8文字以上100文字以内、大文字・小文字・数字・記号を含む
export const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .max(100, 'パスワードは100文字以内で入力してください')
  .regex(/[A-Z]/, 'パスワードには大文字を含めてください')
  .regex(/[a-z]/, 'パスワードには小文字を含めてください')
  .regex(/[0-9]/, 'パスワードには数字を含めてください')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'パスワードには記号を含めてください');

// ユーザー新規登録（メール/パスワード）
export const userRegisterSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  name: z.string().min(1).max(100).trim(),
});

export type UserRegister = z.infer<typeof userRegisterSchema>;

// ユーザーログイン（パスワード強度チェックは不要、ログイン時は任意文字列でOK）
export const userLoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

export type UserLogin = z.infer<typeof userLoginSchema>;

// パスワードリセット要求
export const passwordResetRequestSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

// パスワードリセット実行
export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type PasswordReset = z.infer<typeof passwordResetSchema>;

// パスワード初回設定（OAuthユーザーがパスワードを追加）
export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export type SetPassword = z.infer<typeof setPasswordSchema>;

// パスワード変更
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新しいパスワードは現在のパスワードと異なるものにしてください',
    path: ['newPassword'],
  });

export type ChangePassword = z.infer<typeof changePasswordSchema>;

// ユーザースキーマ
export const userCreateSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  name: z.string().min(1).max(100),
  avatarUrl: z.string().url().nullish(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullish(),
});

// 組織スキーマ
export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
});

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
});

export const organizationInviteSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  role: organizationRoleSchema.exclude(['OWNER']),
});

// プロジェクトスキーマ
export const projectCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  organizationId: z.string().uuid().nullish(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
});

export const projectEnvironmentSchema = z.object({
  name: z.string().min(1).max(50),
  baseUrl: z.string().url().nullish(),
  description: z.string().max(200).nullish(),
  isDefault: z.boolean().default(false),
});

// 環境作成スキーマ（projectEnvironmentSchemaと同じ）
export const projectEnvironmentCreateSchema = projectEnvironmentSchema;

// 環境更新スキーマ（全フィールドoptional）
export const projectEnvironmentUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  baseUrl: z.string().url().nullish(),
  description: z.string().max(200).nullish(),
  isDefault: z.boolean().optional(),
});

// 環境並替スキーマ
export const projectEnvironmentReorderSchema = z.object({
  environmentIds: z.array(z.string().uuid()).min(1),
});

// テストケース並替スキーマ
export const testCaseReorderSchema = z.object({
  testCaseIds: z.array(z.string().uuid()).min(1),
});

// テストスイートスキーマ
export const testSuiteCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  status: entityStatusSchema.default(EntityStatus.DRAFT),
  preconditions: z
    .array(
      z.object({
        content: z.string().min(1).max(1000),
      })
    )
    .optional(),
});

export const testSuiteUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  status: entityStatusSchema.optional(),
});

// テストケーススキーマ
export const testCaseCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  priority: testCasePrioritySchema.default(TestCasePriority.MEDIUM),
  status: entityStatusSchema.default(EntityStatus.DRAFT),
  preconditions: z
    .array(
      z.object({
        content: z.string().min(1).max(1000),
      })
    )
    .optional(),
  steps: z
    .array(
      z.object({
        content: z.string().min(1).max(1000),
      })
    )
    .optional(),
  expectedResults: z
    .array(
      z.object({
        content: z.string().min(1).max(1000),
      })
    )
    .optional(),
});

export const testCaseUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  priority: testCasePrioritySchema.optional(),
  status: entityStatusSchema.optional(),
});

// 実行スキーマ
export const executionCreateSchema = z.object({
  testSuiteId: z.string().uuid(),
  environmentId: z.string().uuid().nullish(),
});

export const executionResultUpdateSchema = z.object({
  status: z.union([preconditionStatusSchema, stepStatusSchema, judgmentStatusSchema]),
  note: z.string().max(1000).nullish(),
});

// テストスイート検索スキーマ
export const testSuiteSearchSchema = z.object({
  q: z.string().max(100).optional(),
  status: entityStatusSchema.default(EntityStatus.ACTIVE),
  // ラベルフィルター: カンマ区切り → 配列変換（OR条件）
  labelIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()).filter((s) => s.length > 0) : undefined))
    .pipe(z.array(z.string().uuid()).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeDeleted: z.coerce.boolean().default(false),
});

// テストケース検索スキーマ
export const testCaseSearchSchema = z.object({
  q: z.string().max(100).optional(),
  // 複数選択対応: カンマ区切り → 配列変換
  status: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(entityStatusSchema).optional()),
  priority: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(testCasePrioritySchema).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'priority', 'orderKey']).default('orderKey'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeDeleted: z.coerce.boolean().default(false),
});

// 実行履歴検索スキーマ
export const executionSearchSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  // 'none'は環境未設定の実行をフィルタするための特殊値
  environmentId: z.union([z.string().uuid(), z.literal('none')]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// サジェスト検索スキーマ（@メンション用）
export const suggestionSearchSchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// レビューコメントスキーマ
export const reviewTargetTypeSchema = z.enum(['SUITE', 'CASE']);
export const reviewTargetFieldSchema = z.enum(['TITLE', 'DESCRIPTION', 'PRECONDITION', 'STEP', 'EXPECTED_RESULT']);
export const reviewStatusSchema = z.enum(['OPEN', 'RESOLVED']);
export const reviewSessionStatusSchema = z.enum([ReviewSessionStatus.DRAFT, ReviewSessionStatus.SUBMITTED]);
export const reviewVerdictSchema = z.enum([
  ReviewVerdict.APPROVED,
  ReviewVerdict.CHANGES_REQUESTED,
  ReviewVerdict.COMMENT_ONLY,
]);

// レビューセッションスキーマ
export const reviewCreateSchema = z.object({
  summary: z.string().max(5000).optional(),
});

export const reviewUpdateSchema = z.object({
  summary: z.string().max(5000).optional(),
});

export const reviewSubmitSchema = z.object({
  verdict: reviewVerdictSchema,
  summary: z.string().max(5000).optional(),
});

export const reviewSearchSchema = z.object({
  verdict: reviewVerdictSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// レビューコメントスキーマ（レビューセッション内）
export const reviewCommentCreateSchema = z.object({
  targetType: reviewTargetTypeSchema,
  targetId: z.string().uuid(),
  targetField: reviewTargetFieldSchema,
  targetItemId: z.string().uuid().optional(),
  targetItemContent: z.string().max(1000).optional(),
  content: z.string().min(1).max(2000),
});

export const reviewCommentUpdateSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const reviewStatusUpdateSchema = z.object({
  status: reviewStatusSchema,
});

// 提出済みレビューの評価変更スキーマ
export const reviewVerdictUpdateSchema = z.object({
  verdict: reviewVerdictSchema,
});

export const reviewReplyCreateSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const reviewCommentSearchSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'ALL']).default('ALL'),
  targetField: reviewTargetFieldSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ラベルスキーマ
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const labelCreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullish(),
  color: z.string().regex(hexColorRegex, '色はHEX形式（例: #FF5733）で指定してください'),
});

export const labelUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).nullish(),
  color: z.string().regex(hexColorRegex, '色はHEX形式（例: #FF5733）で指定してください').optional(),
});

// テストスイートラベル一括更新スキーマ
export const testSuiteLabelsUpdateSchema = z.object({
  labelIds: z.array(z.string().uuid()),
});

// 監査ログカテゴリの配列（バリデーション用）
const auditLogCategories = [
  AuditLogCategory.AUTH,
  AuditLogCategory.USER,
  AuditLogCategory.ORGANIZATION,
  AuditLogCategory.MEMBER,
  AuditLogCategory.PROJECT,
  AuditLogCategory.API_TOKEN,
] as const;

// 監査ログエクスポートスキーマ
export const auditLogExportSchema = z.object({
  format: z.enum(['csv', 'json']),
  category: z.enum(auditLogCategories).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'startDateはendDate以前の日付を指定してください',
    path: ['startDate'],
  }
);

// 型エクスポート
export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationInvite = z.infer<typeof organizationInviteSchema>;
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type ProjectEnvironmentInput = z.infer<typeof projectEnvironmentSchema>;
export type ProjectEnvironmentCreate = z.infer<typeof projectEnvironmentCreateSchema>;
export type ProjectEnvironmentUpdate = z.infer<typeof projectEnvironmentUpdateSchema>;
export type ProjectEnvironmentReorder = z.infer<typeof projectEnvironmentReorderSchema>;
export type TestCaseReorder = z.infer<typeof testCaseReorderSchema>;
export type TestSuiteCreate = z.infer<typeof testSuiteCreateSchema>;
export type TestSuiteUpdate = z.infer<typeof testSuiteUpdateSchema>;
export type TestCaseCreate = z.infer<typeof testCaseCreateSchema>;
export type TestCaseUpdate = z.infer<typeof testCaseUpdateSchema>;
export type ExecutionCreate = z.infer<typeof executionCreateSchema>;
export type ExecutionResultUpdate = z.infer<typeof executionResultUpdateSchema>;
export type TestSuiteSearch = z.infer<typeof testSuiteSearchSchema>;
export type TestCaseSearch = z.infer<typeof testCaseSearchSchema>;
export type ExecutionSearch = z.infer<typeof executionSearchSchema>;
export type SuggestionSearch = z.infer<typeof suggestionSearchSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Sort = z.infer<typeof sortSchema>;
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdate = z.infer<typeof reviewUpdateSchema>;
export type ReviewSubmit = z.infer<typeof reviewSubmitSchema>;
export type ReviewSearch = z.infer<typeof reviewSearchSchema>;
export type ReviewCommentCreate = z.infer<typeof reviewCommentCreateSchema>;
export type ReviewCommentUpdate = z.infer<typeof reviewCommentUpdateSchema>;
export type ReviewStatusUpdate = z.infer<typeof reviewStatusUpdateSchema>;
export type ReviewVerdictUpdate = z.infer<typeof reviewVerdictUpdateSchema>;
export type ReviewReplyCreate = z.infer<typeof reviewReplyCreateSchema>;
export type ReviewCommentSearch = z.infer<typeof reviewCommentSearchSchema>;
export type LabelCreate = z.infer<typeof labelCreateSchema>;
export type LabelUpdate = z.infer<typeof labelUpdateSchema>;
export type TestSuiteLabelsUpdate = z.infer<typeof testSuiteLabelsUpdateSchema>;
export type AuditLogExport = z.infer<typeof auditLogExportSchema>;

// ============================================
// 管理者向けユーザー検索スキーマ
// ============================================

export const adminUserSearchSchema = z.object({
  // 検索クエリ
  q: z.string().max(100).optional(),
  // ステータスフィルタ
  status: z.enum(['active', 'deleted', 'all']).default('active'),
  // 日付フィルタ
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  // ページネーション
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // ソート
  sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminUserSearch = z.infer<typeof adminUserSearchSchema>;

// ============================================
// 管理者向け組織検索スキーマ
// ============================================

export const adminOrganizationSearchSchema = z.object({
  // 検索クエリ
  q: z.string().max(100).optional(),
  // ステータスフィルタ
  status: z.enum(['active', 'deleted', 'all']).default('active'),
  // 日付フィルタ
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  // ページネーション
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // ソート
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    if (data.createdFrom && data.createdTo) {
      return new Date(data.createdFrom) <= new Date(data.createdTo);
    }
    return true;
  },
  {
    message: 'createdFromはcreatedTo以前の日付を指定してください',
    path: ['createdFrom'],
  }
);

export type AdminOrganizationSearch = z.infer<typeof adminOrganizationSearchSchema>;

// ============================================
// 管理者向け監査ログ検索スキーマ
// ============================================

export const adminAuditLogSearchSchema = z.object({
  // 検索クエリ（アクション名で部分一致）
  q: z.string().max(100).optional(),
  // カテゴリフィルタ（カンマ区切り → 配列変換）
  category: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(z.enum([
      AuditLogCategory.AUTH,
      AuditLogCategory.USER,
      AuditLogCategory.ORGANIZATION,
      AuditLogCategory.MEMBER,
      AuditLogCategory.PROJECT,
      AuditLogCategory.API_TOKEN,
    ])).optional()),
  // 組織IDフィルタ
  organizationId: z.string().uuid().optional(),
  // ユーザーIDフィルタ
  userId: z.string().uuid().optional(),
  // 日付フィルタ
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // ページネーション
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // ソート
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    // 両方指定されている場合のみ日付の前後関係をチェック
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'startDateはendDate以前の日付を指定してください',
    path: ['startDate'],
  }
);

export type AdminAuditLogSearch = z.infer<typeof adminAuditLogSearchSchema>;


// ============================================
// システム管理者（AdminUser）検索スキーマ
// ============================================

// システム管理者ロール
const systemAdminRoleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']);

export const systemAdminSearchSchema = z.object({
  // 検索クエリ（メール・名前で部分一致）
  q: z.string().max(100).optional(),
  // ロールフィルタ（カンマ区切り → 配列変換）
  role: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(systemAdminRoleSchema).optional()),
  // ステータスフィルタ
  status: z.enum(['active', 'deleted', 'locked', 'all']).default('active'),
  // 2FA有効状態フィルタ
  totpEnabled: z.preprocess(
    (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    },
    z.boolean().optional()
  ),
  // 日付フィルタ
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  // ページネーション
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // ソート
  sortBy: z.enum(['createdAt', 'name', 'email', 'role', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    if (data.createdFrom && data.createdTo) {
      return new Date(data.createdFrom) <= new Date(data.createdTo);
    }
    return true;
  },
  {
    message: 'createdFromはcreatedTo以前の日付を指定してください',
    path: ['createdFrom'],
  }
);

export type SystemAdminSearch = z.infer<typeof systemAdminSearchSchema>;

// システム管理者招待スキーマ
export const systemAdminInviteSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください').max(255).transform((v) => v.toLowerCase().trim()),
  name: z.string().min(1, '名前は必須です').max(100),
  role: systemAdminRoleSchema,
});

export type SystemAdminInvite = z.infer<typeof systemAdminInviteSchema>;

// システム管理者更新スキーマ
export const systemAdminUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: systemAdminRoleSchema.optional(),
});

export type SystemAdminUpdate = z.infer<typeof systemAdminUpdateSchema>;

// 招待受諾スキーマ（パスワード設定）
export const acceptInvitationSchema = z.object({
  password: passwordSchema,
});

export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;
