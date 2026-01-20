import { prisma, type PreconditionStatus, type StepStatus, type JudgmentStatus } from '@agentest/db';
import { NotFoundError, BadRequestError } from '@agentest/shared';
import { createStorageClient } from '@agentest/storage';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionRepository } from '../repositories/execution.repository.js';
import { MAX_EVIDENCES_PER_RESULT } from '../config/upload.js';
import { publishDashboardUpdated } from '../lib/redis-publisher.js';

/**
 * 実施者情報のコンテキスト
 */
export interface ExecutorContext {
  userId: string;         // 実施ユーザーID
  agentName?: string;     // MCPエージェント名（例：Claude Code Opus4.5）
}

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
   * 実行をIDで詳細付きで検索（正規化テーブル、全結果データ含む）
   */
  async findByIdWithDetails(executionId: string) {
    const execution = await this.executionRepo.findByIdWithDetails(executionId);
    if (!execution) {
      throw new NotFoundError('Execution', executionId);
    }

    // エビデンスのfileSizeをBigIntからnumberに変換（JSONシリアライズのため）
    const expectedResults = execution.expectedResults.map((result) => ({
      ...result,
      evidences: result.evidences.map((evidence) => ({
        ...evidence,
        fileSize: Number(evidence.fileSize),
      })),
    }));

    return {
      ...execution,
      expectedResults,
    };
  }

  /**
   * 前提条件結果を更新
   */
  async updatePreconditionResult(
    executionId: string,
    preconditionResultId: string,
    data: { status: PreconditionStatus; note?: string },
    executor?: ExecutorContext
  ) {
    const execution = await this.findById(executionId);

    const result = await prisma.executionPreconditionResult.findFirst({
      where: {
        id: preconditionResultId,
        executionId,
      },
    });

    if (!result) {
      throw new NotFoundError('ExecutionPreconditionResult', preconditionResultId);
    }

    const updated = await prisma.executionPreconditionResult.update({
      where: { id: preconditionResultId },
      data: {
        status: data.status,
        note: data.note,
        checkedAt: data.status !== 'UNCHECKED' ? new Date() : null,
        // 実施者情報を記録
        checkedByUserId: executor?.userId,
        checkedByAgentName: executor?.agentName,
      },
      include: {
        checkedByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(execution.testSuite.projectId, 'execution', executionId);

    return updated;
  }

  /**
   * ステップ結果を更新
   */
  async updateStepResult(
    executionId: string,
    stepResultId: string,
    data: { status: StepStatus; note?: string },
    executor?: ExecutorContext
  ) {
    const execution = await this.findById(executionId);

    const result = await prisma.executionStepResult.findFirst({
      where: {
        id: stepResultId,
        executionId,
      },
    });

    if (!result) {
      throw new NotFoundError('ExecutionStepResult', stepResultId);
    }

    const updated = await prisma.executionStepResult.update({
      where: { id: stepResultId },
      data: {
        status: data.status,
        note: data.note,
        executedAt: data.status !== 'PENDING' ? new Date() : null,
        // 実施者情報を記録
        executedByUserId: executor?.userId,
        executedByAgentName: executor?.agentName,
      },
      include: {
        executedByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(execution.testSuite.projectId, 'execution', executionId);

    return updated;
  }

  /**
   * 期待結果を更新
   */
  async updateExpectedResult(
    executionId: string,
    expectedResultId: string,
    data: { status: JudgmentStatus; note?: string },
    executor?: ExecutorContext
  ) {
    const execution = await this.findById(executionId);

    const result = await prisma.executionExpectedResult.findFirst({
      where: {
        id: expectedResultId,
        executionId,
      },
    });

    if (!result) {
      throw new NotFoundError('ExecutionExpectedResult', expectedResultId);
    }

    const updated = await prisma.executionExpectedResult.update({
      where: { id: expectedResultId },
      data: {
        status: data.status,
        note: data.note,
        judgedAt: data.status !== 'PENDING' ? new Date() : null,
        // 実施者情報を記録
        judgedByUserId: executor?.userId,
        judgedByAgentName: executor?.agentName,
      },
      include: {
        judgedByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(execution.testSuite.projectId, 'execution', executionId);

    return updated;
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
    await this.findById(executionId);

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
