-- AlterEnum
ALTER TYPE "OrganizationPlan" ADD VALUE 'NONE';

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'NONE';
