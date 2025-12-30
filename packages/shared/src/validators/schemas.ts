import { z } from 'zod';
import {
  UserPlan,
  OrganizationPlan,
  OrganizationRole,
  ProjectRole,
  EntityStatus,
  TestCasePriority,
  ExecutionStatus,
  PreconditionStatus,
  StepStatus,
  JudgmentStatus,
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
export const userPlanSchema = z.enum([UserPlan.FREE, UserPlan.PRO]);
export const organizationPlanSchema = z.enum([OrganizationPlan.TEAM, OrganizationPlan.ENTERPRISE]);
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
export const executionStatusSchema = z.enum([
  ExecutionStatus.IN_PROGRESS,
  ExecutionStatus.COMPLETED,
  ExecutionStatus.ABORTED,
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
  JudgmentStatus.NOT_EXECUTABLE,
]);

// ユーザースキーマ
export const userCreateSchema = z.object({
  email: z.string().email().max(255),
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
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).nullish(),
  billingEmail: z.string().email().nullish(),
});

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  billingEmail: z.string().email().nullish(),
});

export const organizationInviteSchema = z.object({
  email: z.string().email(),
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
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'スラッグは小文字英数字とハイフンのみ使用可能です'),
  baseUrl: z.string().url().nullish(),
  description: z.string().max(200).nullish(),
  isDefault: z.boolean().default(false),
});

// 環境作成スキーマ（projectEnvironmentSchemaと同じ）
export const projectEnvironmentCreateSchema = projectEnvironmentSchema;

// 環境更新スキーマ（全フィールドoptional）
export const projectEnvironmentUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'スラッグは小文字英数字とハイフンのみ使用可能です')
    .optional(),
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
  status: entityStatusSchema.optional(),
  createdBy: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
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
  status: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(executionStatusSchema).optional()),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['startedAt', 'completedAt', 'status']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// サジェスト検索スキーマ（@メンション用）
export const suggestionSearchSchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

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
