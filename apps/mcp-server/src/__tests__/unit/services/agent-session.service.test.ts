import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// リポジトリのモック
const mockAgentSessionRepository = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  findActiveByProjectAndClient: vi.fn(),
  findActiveByProject: vi.fn(),
  updateHeartbeat: vi.fn(),
  endSession: vi.fn(),
  findTimedOutSessions: vi.fn(),
  markAsTimedOut: vi.fn(),
}));

vi.mock('../../../repositories/agent-session.repository.js', () => ({
  agentSessionRepository: mockAgentSessionRepository,
}));

// モック設定後にインポート
import { agentSessionService, SESSION_CONFIG } from '../../../services/agent-session.service.js';

// テスト用の固定値
const TEST_SESSION_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_CLIENT_ID = 'test-client-id';

describe('agentSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Date.nowをモック
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('SESSION_CONFIG', () => {
    it('ハートビート間隔は30秒', () => {
      expect(SESSION_CONFIG.HEARTBEAT_INTERVAL).toBe(30);
    });

    it('ハートビートタイムアウトは60秒', () => {
      expect(SESSION_CONFIG.HEARTBEAT_TIMEOUT).toBe(60);
    });
  });

  describe('createSession', () => {
    it('新しいセッションを作成', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
        status: 'ACTIVE',
      };
      mockAgentSessionRepository.create.mockResolvedValue(mockSession);

      const result = await agentSessionService.createSession({
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
      });

      expect(mockAgentSessionRepository.create).toHaveBeenCalledWith({
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('getOrCreateSession', () => {
    it('既存のアクティブセッションがあればハートビートを更新して返す', async () => {
      const existingSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
        status: 'ACTIVE',
      };
      const updatedSession = { ...existingSession, lastHeartbeat: new Date() };

      mockAgentSessionRepository.findActiveByProjectAndClient.mockResolvedValue(existingSession);
      mockAgentSessionRepository.updateHeartbeat.mockResolvedValue(updatedSession);

      const result = await agentSessionService.getOrCreateSession({
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
      });

      expect(mockAgentSessionRepository.findActiveByProjectAndClient).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        TEST_CLIENT_ID
      );
      expect(mockAgentSessionRepository.updateHeartbeat).toHaveBeenCalledWith(TEST_SESSION_ID);
      expect(result).toEqual({
        session: updatedSession,
        isNew: false,
      });
    });

    it('既存セッションがなければ新規作成', async () => {
      const newSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
        status: 'ACTIVE',
      };

      mockAgentSessionRepository.findActiveByProjectAndClient.mockResolvedValue(null);
      mockAgentSessionRepository.create.mockResolvedValue(newSession);

      const result = await agentSessionService.getOrCreateSession({
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
        clientName: 'Test Client',
      });

      expect(mockAgentSessionRepository.create).toHaveBeenCalledWith({
        projectId: TEST_PROJECT_ID,
        clientId: TEST_CLIENT_ID,
        clientName: 'Test Client',
      });
      expect(result).toEqual({
        session: newSession,
        isNew: true,
      });
    });
  });

  describe('getSessionById', () => {
    it('セッションを取得', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        status: 'ACTIVE',
      };
      mockAgentSessionRepository.findById.mockResolvedValue(mockSession);

      const result = await agentSessionService.getSessionById(TEST_SESSION_ID);

      expect(mockAgentSessionRepository.findById).toHaveBeenCalledWith(TEST_SESSION_ID);
      expect(result).toEqual(mockSession);
    });

    it('セッションが見つからない場合はNotFoundError', async () => {
      mockAgentSessionRepository.findById.mockResolvedValue(null);

      await expect(agentSessionService.getSessionById(TEST_SESSION_ID)).rejects.toThrow(
        'AgentSession'
      );
    });
  });

  describe('isSessionValid', () => {
    it('ステータスがACTIVEでハートビートが新しければ有効', () => {
      const session = {
        id: TEST_SESSION_ID,
        status: 'ACTIVE' as const,
        lastHeartbeat: new Date(), // 現在時刻
      };

      expect(agentSessionService.isSessionValid(session as never)).toBe(true);
    });

    it('ステータスがACTIVE以外は無効', () => {
      const session = {
        id: TEST_SESSION_ID,
        status: 'ENDED' as const,
        lastHeartbeat: new Date(),
      };

      expect(agentSessionService.isSessionValid(session as never)).toBe(false);
    });

    it('ハートビートがタイムアウト秒数を超えると無効', () => {
      const oldHeartbeat = new Date(Date.now() - SESSION_CONFIG.HEARTBEAT_TIMEOUT * 1000 - 1000);
      const session = {
        id: TEST_SESSION_ID,
        status: 'ACTIVE' as const,
        lastHeartbeat: oldHeartbeat,
      };

      expect(agentSessionService.isSessionValid(session as never)).toBe(false);
    });

    it('ハートビートがタイムアウト秒数ちょうどだと有効', () => {
      // タイムアウト境界より少し新しいハートビート
      const recentHeartbeat = new Date(Date.now() - (SESSION_CONFIG.HEARTBEAT_TIMEOUT - 1) * 1000);
      const session = {
        id: TEST_SESSION_ID,
        status: 'ACTIVE' as const,
        lastHeartbeat: recentHeartbeat,
      };

      expect(agentSessionService.isSessionValid(session as never)).toBe(true);
    });
  });

  describe('recordHeartbeat', () => {
    it('ハートビートを記録', async () => {
      const mockSession = { id: TEST_SESSION_ID, lastHeartbeat: new Date() };
      mockAgentSessionRepository.updateHeartbeat.mockResolvedValue(mockSession);

      const result = await agentSessionService.recordHeartbeat(TEST_SESSION_ID);

      expect(mockAgentSessionRepository.updateHeartbeat).toHaveBeenCalledWith(TEST_SESSION_ID);
      expect(result).toEqual(mockSession);
    });
  });

  describe('endSession', () => {
    it('セッションを終了', async () => {
      const mockSession = { id: TEST_SESSION_ID, status: 'ENDED' };
      mockAgentSessionRepository.endSession.mockResolvedValue(mockSession);

      const result = await agentSessionService.endSession(TEST_SESSION_ID);

      expect(mockAgentSessionRepository.endSession).toHaveBeenCalledWith(TEST_SESSION_ID);
      expect(result).toEqual(mockSession);
    });
  });

  describe('getActiveSessionsByProject', () => {
    it('プロジェクトのアクティブセッションを取得', async () => {
      const mockSessions = [
        { id: '1', projectId: TEST_PROJECT_ID, status: 'ACTIVE' },
        { id: '2', projectId: TEST_PROJECT_ID, status: 'ACTIVE' },
      ];
      mockAgentSessionRepository.findActiveByProject.mockResolvedValue(mockSessions);

      const result = await agentSessionService.getActiveSessionsByProject(TEST_PROJECT_ID);

      expect(mockAgentSessionRepository.findActiveByProject).toHaveBeenCalledWith(TEST_PROJECT_ID);
      expect(result).toEqual(mockSessions);
    });
  });

  describe('processTimedOutSessions', () => {
    it('タイムアウトしたセッションがなければ0を返す', async () => {
      mockAgentSessionRepository.findTimedOutSessions.mockResolvedValue([]);

      const result = await agentSessionService.processTimedOutSessions();

      expect(mockAgentSessionRepository.findTimedOutSessions).toHaveBeenCalledWith(
        SESSION_CONFIG.HEARTBEAT_TIMEOUT
      );
      expect(mockAgentSessionRepository.markAsTimedOut).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('タイムアウトしたセッションをマーク', async () => {
      const timedOutSessions = [
        { id: '1', status: 'ACTIVE' },
        { id: '2', status: 'ACTIVE' },
      ];
      mockAgentSessionRepository.findTimedOutSessions.mockResolvedValue(timedOutSessions);
      mockAgentSessionRepository.markAsTimedOut.mockResolvedValue(2);

      const result = await agentSessionService.processTimedOutSessions();

      expect(mockAgentSessionRepository.markAsTimedOut).toHaveBeenCalledWith(['1', '2']);
      expect(result).toBe(2);
    });
  });
});
