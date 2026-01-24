-- DropIndex
DROP INDEX IF EXISTS "project_environments_project_id_slug_key";

-- AlterTable
ALTER TABLE "project_environments" DROP COLUMN IF EXISTS "slug";
