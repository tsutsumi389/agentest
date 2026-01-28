-- DropIndex
DROP INDEX "organizations_slug_idx";

-- DropIndex
DROP INDEX "organizations_slug_key";

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "slug";
