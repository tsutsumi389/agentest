import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// agentSessionServiceのモック
const mockAgentSessionService = vi.hoisted(() => ({
  getOrCreateSession: vi.fn(),
  recordHeartbeat: vi.fn(),
}));

vi.mock('../../../services/agent-session.service.js', () => ({
  agentSessionService: mockAgentSessionService,
}));

// モック設定後にインポート
import { agentSession, recordHeartbeat } from '../../../middleware/agent-session.middleware.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_CLIENT_ID = 'test-client-id';
const TEST_SESSION_ID = '33333333-3333-3333-3333-333333333333';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: {},
    user: undefined,
    agentSession: undefined,
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('agentSession', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('クライアント情報抽出', () => {
    it('X-MCP-Client-IdヘッダーからクライアントIDを抽出', async () => {
      const mockSession = { id: TEST_SESSION_ID, status: 'ACTIVE' };
      mockAgentSessionService.getOrCreateSession.mockResolvedValue({
        session: mockSession,
        isNew: true,
      });

      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: true,
      });

      const req = createMockRequest({
        headers: {
          'x-mcp-client-id': TEST_CLIENT_ID,
          'x-mcp-client-name': 'Test Client',
        },
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockAgentSessionService.getOrCreateSession).toHaveBeenCalledWith({
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
        clientName: 'Test Client',
      });
    });

    it('X-MCP-Client-Idがなくrequired=trueの場合はBadRequestError', async () => {
      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: true,
      });

      const req = createMockRequest({
        headers: {},
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'X-MCP-Client-Id ヘッダーが必要です',
        })
      );
    });

    it('X-MCP-Client-Idがなくrequired=falseの場合は次へ進む', async () => {
      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: false,
      });

      const req = createMockRequest({
        headers: {},
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockAgentSessionService.getOrCreateSession).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('認証チェック', () => {
    it('認証されていない場合はAuthorizationError', async () => {
      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: true,
      });

      const req = createMockRequest({
        headers: { 'x-mcp-client-id': TEST_CLIENT_ID },
        user: undefined,
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '認証が必要です',
        })
      );
    });
  });

  describe('プロジェクトID', () => {
    it('プロジェクトIDがなくrequired=trueの場合はBadRequestError', async () => {
      const middleware = agentSession({
        getProjectId: () => null,
        required: true,
      });

      const req = createMockRequest({
        headers: { 'x-mcp-client-id': TEST_CLIENT_ID },
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'プロジェクトIDが必要です',
        })
      );
    });

    it('プロジェクトIDがなくrequired=falseの場合は次へ進む', async () => {
      const middleware = agentSession({
        getProjectId: () => null,
        required: false,
      });

      const req = createMockRequest({
        headers: { 'x-mcp-client-id': TEST_CLIENT_ID },
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockAgentSessionService.getOrCreateSession).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('セッション管理', () => {
    it('新規セッションが作成されたらreq.agentSessionに設定', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        status: 'ACTIVE',
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
      };
      mockAgentSessionService.getOrCreateSession.mockResolvedValue({
        session: mockSession,
        isNew: true,
      });

      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: true,
      });

      const req = createMockRequest({
        headers: { 'x-mcp-client-id': TEST_CLIENT_ID },
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.agentSession).toEqual(mockSession);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('既存セッションが見つかったらreq.agentSessionに設定', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        status: 'ACTIVE',
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
      };
      mockAgentSessionService.getOrCreateSession.mockResolvedValue({
        session: mockSession,
        isNew: false,
      });

      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: true,
      });

      const req = createMockRequest({
        headers: { 'x-mcp-client-id': TEST_CLIENT_ID },
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.agentSession).toEqual(mockSession);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('エラーハンドリング', () => {
    it('セッションサービスがエラーをthrowしたらnextに渡す', async () => {
      const error = new Error('Database error');
      mockAgentSessionService.getOrCreateSession.mockRejectedValue(error);

      const middleware = agentSession({
        getProjectId: () => TEST_PROJECT_ID,
        required: true,
      });

      const req = createMockRequest({
        headers: { 'x-mcp-client-id': TEST_CLIENT_ID },
        user: { id: TEST_USER_ID } as Request['user'],
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});

describe('recordHeartbeat', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  it('セッションがある場合はハートビートを記録', async () => {
    const mockSession = { id: TEST_SESSION_ID };
    mockAgentSessionService.recordHeartbeat.mockResolvedValue(mockSession);

    const middleware = recordHeartbeat();
    const req = createMockRequest({
      agentSession: mockSession as Request['agentSession'],
    });
    const res = createMockResponse();

    await middleware(req as Request, res as Response, mockNext);

    expect(mockAgentSessionService.recordHeartbeat).toHaveBeenCalledWith(TEST_SESSION_ID);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('セッションがない場合はスキップ', async () => {
    const middleware = recordHeartbeat();
    const req = createMockRequest({
      agentSession: undefined,
    });
    const res = createMockResponse();

    await middleware(req as Request, res as Response, mockNext);

    expect(mockAgentSessionService.recordHeartbeat).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('ハートビート更新エラーは無視して続行', async () => {
    mockAgentSessionService.recordHeartbeat.mockRejectedValue(new Error('Update failed'));

    const middleware = recordHeartbeat();
    const req = createMockRequest({
      agentSession: { id: TEST_SESSION_ID } as Request['agentSession'],
    });
    const res = createMockResponse();

    await middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});
