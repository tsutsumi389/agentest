-- AlterTable
ALTER TABLE "execution_expected_results" ADD COLUMN     "judged_by_agent_name" VARCHAR(100),
ADD COLUMN     "judged_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "execution_precondition_results" ADD COLUMN     "checked_by_agent_name" VARCHAR(100),
ADD COLUMN     "checked_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "execution_step_results" ADD COLUMN     "executed_by_agent_name" VARCHAR(100),
ADD COLUMN     "executed_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "execution_precondition_results" ADD CONSTRAINT "execution_precondition_results_checked_by_user_id_fkey" FOREIGN KEY ("checked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_step_results" ADD CONSTRAINT "execution_step_results_executed_by_user_id_fkey" FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_expected_results" ADD CONSTRAINT "execution_expected_results_judged_by_user_id_fkey" FOREIGN KEY ("judged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
