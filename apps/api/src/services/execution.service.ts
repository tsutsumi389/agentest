import { prisma, type PreconditionStatus, type StepStatus, type JudgmentStatus } from '@agentest/db';
import { NotFoundError, ConflictError } from '@agentest/shared';
import { ExecutionRepository } from '../repositories/execution.repository.js';

/**
 * 実行サービス
 */
export class ExecutionService {
  private executionRepo = new ExecutionRepository();

  /**
   * 実行をIDで検索
   */
  async findById(executionId: string) {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new NotFoundError('Execution', executionId);
    }
    return execution;
  }

  /**
   * 実行を中止
   */
  async abort(executionId: string) {
    const execution = await this.findById(executionId);

    if (execution.status !== 'IN_PROGRESS') {
      throw new ConflictError('進行中の実行のみ中止できます');
    }

    return prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'ABORTED',
        completedAt: new Date(),
      },
    });
  }

  /**
   * 実行を完了
   */
  async complete(executionId: string) {
    const execution = await this.findById(executionId);

    if (execution.status !== 'IN_PROGRESS') {
      throw new ConflictError('進行中の実行のみ完了できます');
    }

    return prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  /**
   * 前提条件結果を更新
   */
  async updatePreconditionResult(
    executionId: string,
    preconditionResultId: string,
    data: { status: PreconditionStatus; note?: string }
  ) {
    await this.findById(executionId);

    const result = await prisma.executionPreconditionResult.findFirst({
      where: {
        id: preconditionResultId,
        executionId,
      },
    });

    if (!result) {
      throw new NotFoundError('ExecutionPreconditionResult', preconditionResultId);
    }

    return prisma.executionPreconditionResult.update({
      where: { id: preconditionResultId },
      data: {
        status: data.status,
        note: data.note,
        checkedAt: data.status !== 'UNCHECKED' ? new Date() : null,
      },
    });
  }

  /**
   * ステップ結果を更新
   */
  async updateStepResult(
    executionId: string,
    stepResultId: string,
    data: { status: StepStatus; note?: string }
  ) {
    await this.findById(executionId);

    const result = await prisma.executionStepResult.findFirst({
      where: {
        id: stepResultId,
        executionId,
      },
    });

    if (!result) {
      throw new NotFoundError('ExecutionStepResult', stepResultId);
    }

    return prisma.executionStepResult.update({
      where: { id: stepResultId },
      data: {
        status: data.status,
        note: data.note,
        executedAt: data.status !== 'PENDING' ? new Date() : null,
      },
    });
  }

  /**
   * 期待結果を更新
   */
  async updateExpectedResult(
    executionId: string,
    expectedResultId: string,
    data: { status: JudgmentStatus; note?: string }
  ) {
    await this.findById(executionId);

    const result = await prisma.executionExpectedResult.findFirst({
      where: {
        id: expectedResultId,
        executionId,
      },
    });

    if (!result) {
      throw new NotFoundError('ExecutionExpectedResult', expectedResultId);
    }

    return prisma.executionExpectedResult.update({
      where: { id: expectedResultId },
      data: {
        status: data.status,
        note: data.note,
        judgedAt: data.status !== 'PENDING' ? new Date() : null,
      },
    });
  }

  /**
   * エビデンスをアップロード
   */
  async uploadEvidence(
    executionId: string,
    expectedResultId: string,
    userId: string,
    data: {
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: number;
      description?: string;
    }
  ) {
    await this.findById(executionId);

    const expectedResult = await prisma.executionExpectedResult.findFirst({
      where: {
        id: expectedResultId,
        executionId,
      },
    });

    if (!expectedResult) {
      throw new NotFoundError('ExecutionExpectedResult', expectedResultId);
    }

    return prisma.executionEvidence.create({
      data: {
        expectedResultId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: BigInt(data.fileSize),
        description: data.description,
        uploadedByUserId: userId,
      },
    });
  }
}
