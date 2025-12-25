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
    .regex(/^[a-z0-9-]+$/),
  baseUrl: z.string().url().nullish(),
  description: z.string().max(200).nullish(),
  isDefault: z.boolean().default(false),
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

// 型エクスポート
export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationInvite = z.infer<typeof organizationInviteSchema>;
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type ProjectEnvironmentInput = z.infer<typeof projectEnvironmentSchema>;
export type TestSuiteCreate = z.infer<typeof testSuiteCreateSchema>;
export type TestSuiteUpdate = z.infer<typeof testSuiteUpdateSchema>;
export type TestCaseCreate = z.infer<typeof testCaseCreateSchema>;
export type TestCaseUpdate = z.infer<typeof testCaseUpdateSchema>;
export type ExecutionCreate = z.infer<typeof executionCreateSchema>;
export type ExecutionResultUpdate = z.infer<typeof executionResultUpdateSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Sort = z.infer<typeof sortSchema>;
