import { prisma, type PreconditionStatus, type StepStatus, type JudgmentStatus } from '@agentest/db';
import { NotFoundError, ConflictError, BadRequestError } from '@agentest/shared';
import { createStorageClient } from '@agentest/storage';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionRepository } from '../repositories/execution.repository.js';
import { MAX_EVIDENCES_PER_RESULT } from '../config/upload.js';

/**
 * 実行サービス
 */
export class ExecutionService {
  private executionRepo = new ExecutionRepository();
  private storage = createStorageClient();

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
   * 実行をIDで詳細付きで検索（スナップショット、全結果データ含む）
   */
  async findByIdWithDetails(executionId: string) {
    const execution = await this.executionRepo.findByIdWithDetails(executionId);
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
    file: Express.Multer.File,
    description?: string
  ) {
    const execution = await this.findById(executionId);

    // 完了済み実行チェック
    if (execution.status !== 'IN_PROGRESS') {
      throw new ConflictError('完了済みの実行にはエビデンスをアップロードできません');
    }

    const expectedResult = await prisma.executionExpectedResult.findFirst({
      where: {
        id: expectedResultId,
        executionId,
      },
      include: {
        evidences: true,
      },
    });

    if (!expectedResult) {
      throw new NotFoundError('ExecutionExpectedResult', expectedResultId);
    }

    // エビデンス上限チェック
    if (expectedResult.evidences.length >= MAX_EVIDENCES_PER_RESULT) {
      throw new BadRequestError(`エビデンスの上限（${MAX_EVIDENCES_PER_RESULT}件）に達しています`);
    }

    // MinIOへのアップロード
    const fileKey = `evidences/${executionId}/${expectedResultId}/${uuidv4()}_${file.originalname}`;
    await this.storage.upload(fileKey, file.buffer, {
      contentType: file.mimetype,
    });

    return prisma.executionEvidence.create({
      data: {
        expectedResultId,
        fileName: file.originalname,
        fileUrl: fileKey,
        fileType: file.mimetype,
        fileSize: BigInt(file.size),
        description,
        uploadedByUserId: userId,
      },
    });
  }

  /**
   * エビデンスを削除
   */
  async deleteEvidence(executionId: string, evidenceId: string) {
    const execution = await this.findById(executionId);

    // 完了済み実行チェック
    if (execution.status !== 'IN_PROGRESS') {
      throw new ConflictError('完了済みの実行のエビデンスは削除できません');
    }

    const evidence = await prisma.executionEvidence.findFirst({
      where: {
        id: evidenceId,
        expectedResult: {
          executionId,
        },
      },
    });

    if (!evidence) {
      throw new NotFoundError('ExecutionEvidence', evidenceId);
    }

    // MinIOからファイル削除
    await this.storage.delete(evidence.fileUrl);

    // DBレコード削除
    await prisma.executionEvidence.delete({
      where: { id: evidenceId },
    });
  }

  /**
   * エビデンスのダウンロードURL取得（署名付き、1時間有効）
   */
  async getEvidenceDownloadUrl(executionId: string, evidenceId: string): Promise<string> {
    await this.findById(executionId);

    const evidence = await prisma.executionEvidence.findFirst({
      where: {
        id: evidenceId,
        expectedResult: {
          executionId,
        },
      },
    });

    if (!evidence) {
      throw new NotFoundError('ExecutionEvidence', evidenceId);
    }

    return this.storage.getDownloadUrl(evidence.fileUrl, {
      expiresIn: 3600, // 1時間
    });
  }
}
