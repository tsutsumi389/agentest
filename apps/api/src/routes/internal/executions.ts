import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InternalAuthorizationService } from '../../services/internal-authorization.service.js';
import { ExecutionService } from '../../services/execution.service.js';
import { evidenceUpload } from '../../config/upload.js';

const router: Router = Router();
const authService = new InternalAuthorizationService();
const executionService = new ExecutionService();

/**
 * 単一取得APIのuserIdクエリパラメータスキーマ
 */
const userIdQuerySchema = z.object({
  userId: z.string().uuid(),
});

/**
 * 事前条件結果更新リクエストボディのスキーマ
 */
const updatePreconditionResultBodySchema = z.object({
  status: z.enum(['MET', 'NOT_MET']),
  note: z.string().max(2000).optional(),
  agentName: z.string().max(100).optional(),
});

/**
 * ステップ結果更新リクエストボディのスキーマ
 */
const updateStepResultBodySchema = z.object({
  status: z.enum(['DONE', 'SKIPPED']),
  note: z.string().max(2000).optional(),
  agentName: z.string().max(100).optional(),
});

/**
 * 期待結果更新リクエストボディのスキーマ
 */
const updateExpectedResultBodySchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  note: z.string().max(2000).optional(),
  agentName: z.string().max(100).optional(),
});

/**
 * エビデンスアップロードURL生成リクエストボディのスキーマ
 */
const createEvidenceUploadUrlBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  description: z.string().max(2000).optional(),
});

/**
 * GET /internal/api/executions/:executionId
 * 実行詳細を取得（全結果データ含む）
 */
router.get('/executions/:executionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId } = req.params;
    const parseResult = userIdQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { userId } = parseResult.data;

    // 実行詳細を取得
    const execution = await executionService.findByIdWithDetails(executionId);

    // 認可チェック（テストスイート経由）
    const canAccess = await authService.canAccessTestSuite(userId, execution.testSuiteId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this execution',
      });
      return;
    }

    res.json({ execution });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/executions/:executionId/precondition-results/:preconditionResultId
 * 事前条件結果を更新
 */
router.patch('/executions/:executionId/precondition-results/:preconditionResultId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, preconditionResultId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = updatePreconditionResultBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { status, note, agentName } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // 事前条件結果更新（実施者情報を含む）
    const preconditionResult = await executionService.updatePreconditionResult(
      executionId,
      preconditionResultId,
      { status, note },
      { userId, agentName }
    );

    res.json({ preconditionResult });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/executions/:executionId/step-results/:stepResultId
 * ステップ結果を更新
 */
router.patch('/executions/:executionId/step-results/:stepResultId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, stepResultId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = updateStepResultBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { status, note, agentName } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // ステップ結果更新（実施者情報を含む）
    const stepResult = await executionService.updateStepResult(
      executionId,
      stepResultId,
      { status, note },
      { userId, agentName }
    );

    res.json({ stepResult });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/executions/:executionId/expected-results/:expectedResultId
 * 期待結果を更新
 */
router.patch('/executions/:executionId/expected-results/:expectedResultId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, expectedResultId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = updateExpectedResultBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { status, note, agentName } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // 期待結果更新（実施者情報を含む）
    const expectedResult = await executionService.updateExpectedResult(
      executionId,
      expectedResultId,
      { status, note },
      { userId, agentName }
    );

    res.json({ expectedResult });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences
 * エビデンスをアップロード（multipart/form-data形式）
 */
router.post('/executions/:executionId/expected-results/:expectedResultId/evidences', evidenceUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, expectedResultId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ファイルの存在チェック
    if (!req.file) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'ファイルが添付されていません',
      });
      return;
    }

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // description検証
    const descriptionSchema = z.string().max(2000).optional();
    const descriptionResult = descriptionSchema.safeParse(req.body.description);
    if (!descriptionResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'descriptionが不正です（最大2000文字）',
      });
      return;
    }
    const description = descriptionResult.data;

    // エビデンスアップロード
    const evidence = await executionService.uploadEvidence(
      executionId,
      expectedResultId,
      userId,
      req.file,
      description
    );

    res.status(201).json({
      evidence: {
        id: evidence.id,
        expectedResultId: evidence.expectedResultId,
        fileName: evidence.fileName,
        fileUrl: evidence.fileUrl,
        fileType: evidence.fileType,
        // BigIntはJSON.stringify()で直接シリアライズできないため、Numberに変換
        fileSize: Number(evidence.fileSize),
        description: evidence.description,
        uploadedByUserId: evidence.uploadedByUserId,
        createdAt: evidence.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences/upload-url
 * エビデンスアップロード用presigned URLを生成
 */
router.post('/executions/:executionId/expected-results/:expectedResultId/evidences/upload-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, expectedResultId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = createEvidenceUploadUrlBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    const { fileName, fileType, description } = bodyResult.data;

    const result = await executionService.createEvidenceUploadUrl(
      executionId,
      expectedResultId,
      userId,
      { fileName, fileType, description }
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /internal/api/executions/:executionId/evidences/:evidenceId/confirm
 * エビデンスアップロード完了を確認
 */
router.post('/executions/:executionId/evidences/:evidenceId/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, evidenceId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    const result = await executionService.confirmEvidenceUpload(executionId, evidenceId, userId);

    res.json({ evidenceId, fileSize: result.fileSize });
  } catch (error) {
    next(error);
  }
});

export default router;
