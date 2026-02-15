import { prisma, type PreconditionStatus, type StepStatus, type JudgmentStatus } from '@agentest/db';
import { NotFoundError, BadRequestError } from '@agentest/shared';
import { createStorageClient, type StorageClient } from '@agentest/storage';
import { randomUUID } from 'node:crypto';
import { ExecutionRepository } from '../repositories/execution.repository.js';
import { MAX_EVIDENCES_PER_RESULT, validateMagicBytes } from '../config/upload.js';
import { publishDashboardUpdated } from '../lib/redis-publisher.js';
import { notificationService } from './notification.service.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'execution' });

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
  private _storage: StorageClient | null = null;

  /** ストレージクライアントを遅延初期化（MINIO_*環境変数が未設定でも起動可能にする） */
  private get storage(): StorageClient {
    if (!this._storage) {
      this._storage = createStorageClient();
    }
    return this._storage;
  }

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

    // テスト完了通知の送信チェック（失敗しても期待結果の更新は成功させる）
    try {
      await this.checkAndSendCompletionNotification(
        executionId,
        execution.testSuite,
        execution.executedByUserId,
        executor?.userId
      );
    } catch (error) {
      logger.error({ err: error }, 'テスト完了通知の送信に失敗しました');
    }

    return updated;
  }

  /**
   * テスト完了通知の送信チェック
   * 全ての期待結果が判定された場合に通知を送信
   */
  private async checkAndSendCompletionNotification(
    executionId: string,
    testSuite: { id: string; name: string; projectId: string },
    executedByUserId: string | null,
    judgedByUserId?: string
  ) {
    // 実行者がいない場合は通知しない
    if (!executedByUserId) {
      return;
    }

    // 判定者と実行者が同じ場合は通知しない
    if (executedByUserId === judgedByUserId) {
      return;
    }

    // 全ての期待結果を取得
    const allResults = await prisma.executionExpectedResult.findMany({
      where: { executionId },
      select: { status: true },
    });

    // 全て判定済みかチェック（PENDINGが残っていない）
    const pendingCount = allResults.filter((r) => r.status === 'PENDING').length;
    if (pendingCount > 0) {
      return; // まだ未判定がある
    }

    // 内訳を計算
    const passCount = allResults.filter((r) => r.status === 'PASS').length;
    const failCount = allResults.filter((r) => r.status === 'FAIL').length;
    const skippedCount = allResults.filter((r) => r.status === 'SKIPPED').length;
    const totalCount = allResults.length;

    // プロジェクト情報を取得
    const project = await prisma.project.findUnique({
      where: { id: testSuite.projectId },
      select: { organizationId: true },
    });

    // 通知本文を生成
    const body = this.buildNotificationBody(testSuite.name, { passCount, failCount, skippedCount, totalCount });

    // 通知データ
    const notificationData = {
      executionId,
      testSuiteId: testSuite.id,
      testSuiteName: testSuite.name,
      passCount,
      failCount,
      skippedCount,
      totalCount,
    };

    if (failCount > 0) {
      await notificationService.send({
        userId: executedByUserId,
        type: 'TEST_FAILED',
        title: 'テスト実行が失敗しました',
        body,
        data: notificationData,
        organizationId: project?.organizationId ?? undefined,
      });
    } else {
      await notificationService.send({
        userId: executedByUserId,
        type: 'TEST_COMPLETED',
        title: 'テスト実行が完了しました',
        body,
        data: notificationData,
        organizationId: project?.organizationId ?? undefined,
      });
    }
  }

  /**
   * 通知本文を生成
   */
  private buildNotificationBody(
    testSuiteName: string,
    counts: { passCount: number; failCount: number; skippedCount: number; totalCount: number }
  ): string {
    const { passCount, failCount, skippedCount, totalCount } = counts;
    const parts: string[] = [];

    if (passCount > 0) parts.push(`成功: ${passCount}件`);
    if (failCount > 0) parts.push(`失敗: ${failCount}件`);
    if (skippedCount > 0) parts.push(`スキップ: ${skippedCount}件`);

    return `「${testSuiteName}」のテスト実行が完了しました（${parts.join('、')}／合計${totalCount}件）`;
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

    // マジックバイト検証（ファイル内容とMIMEタイプの一致を確認）
    await validateMagicBytes(file.buffer, file.mimetype);

    // MinIOへのアップロード
    const fileKey = `evidences/${executionId}/${expectedResultId}/${randomUUID()}_${file.originalname}`;
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
