import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundError, AuthorizationError, ValidationError } from '@agentest/shared'

// Logger モック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  }
  mockLogger.child.mockReturnValue(mockLogger)
  return { mockLogger }
})
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }))

// Repository モック
const mockAgentSessionRepo = vi.hoisted(() => ({
  findByUserProjects: vi.fn(),
  findById: vi.fn(),
  isProjectMember: vi.fn(),
  endSession: vi.fn(),
}))

vi.mock('../../repositories/agent-session.repository.js', () => ({
  AgentSessionRepository: vi.fn().mockImplementation(() => mockAgentSessionRepo),
}))

import { AgentSessionService } from '../../services/agent-session.service.js'

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222'
const TEST_SESSION_ID = '33333333-3333-3333-3333-333333333333'

describe('AgentSessionService', () => {
  let service: AgentSessionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AgentSessionService()
  })

  describe('parseStatuses', () => {
    it('カンマ区切りのステータス文字列をパースする', () => {
      const result = service.parseStatuses('ACTIVE,IDLE')
      expect(result).toEqual(['ACTIVE', 'IDLE'])
    })

    it('未指定の場合デフォルト値を返す', () => {
      const result = service.parseStatuses(undefined)
      expect(result).toEqual(['ACTIVE', 'IDLE'])
    })

    it('空文字の場合デフォルト値を返す', () => {
      const result = service.parseStatuses('')
      expect(result).toEqual(['ACTIVE', 'IDLE'])
    })

    it('無効なステータスは除外する', () => {
      const result = service.parseStatuses('ACTIVE,INVALID,IDLE')
      expect(result).toEqual(['ACTIVE', 'IDLE'])
    })

    it('全て無効な場合デフォルト値を返す', () => {
      const result = service.parseStatuses('INVALID,UNKNOWN')
      expect(result).toEqual(['ACTIVE', 'IDLE'])
    })
  })

  describe('getSessionsByUser', () => {
    it('ユーザーのセッション一覧を取得する', async () => {
      const mockSessions = [
        {
          id: TEST_SESSION_ID,
          projectId: TEST_PROJECT_ID,
          clientId: 'claude-code-xxx',
          clientName: 'Claude Code',
          status: 'ACTIVE',
          startedAt: new Date(),
          lastHeartbeat: new Date(),
          endedAt: null,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
        },
      ]

      mockAgentSessionRepo.findByUserProjects.mockResolvedValue({
        sessions: mockSessions,
        total: 1,
      })

      const result = await service.getSessionsByUser({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE'],
        page: 1,
        limit: 50,
      })

      expect(result.sessions).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.sessions[0]).toEqual(
        expect.objectContaining({
          id: TEST_SESSION_ID,
          projectName: 'テストプロジェクト',
          clientId: 'claude-code-xxx',
        })
      )
    })

    it('レスポンス形式が正しい（projectNameフラット化）', async () => {
      const mockSessions = [
        {
          id: TEST_SESSION_ID,
          projectId: TEST_PROJECT_ID,
          clientId: 'client-1',
          clientName: null,
          status: 'IDLE',
          startedAt: new Date('2025-01-01'),
          lastHeartbeat: new Date('2025-01-01'),
          endedAt: null,
          project: { id: TEST_PROJECT_ID, name: 'Project A' },
        },
      ]

      mockAgentSessionRepo.findByUserProjects.mockResolvedValue({
        sessions: mockSessions,
        total: 1,
      })

      const result = await service.getSessionsByUser({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE'],
        page: 1,
        limit: 50,
      })

      const session = result.sessions[0]
      expect(session).toHaveProperty('projectName', 'Project A')
      expect(session).toHaveProperty('clientId', 'client-1')
      expect(session).toHaveProperty('clientName', null)
      expect(session).toHaveProperty('status', 'IDLE')
      expect(session).toHaveProperty('startedAt')
      expect(session).toHaveProperty('lastHeartbeat')
      expect(session).toHaveProperty('endedAt', null)
    })
  })

  describe('endSession', () => {
    it('セッションを正常に終了する', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        status: 'ACTIVE',
        project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
      }

      mockAgentSessionRepo.findById.mockResolvedValue(mockSession)
      mockAgentSessionRepo.isProjectMember.mockResolvedValue(true)
      mockAgentSessionRepo.endSession.mockResolvedValue({
        ...mockSession,
        status: 'ENDED',
        endedAt: new Date(),
      })

      const result = await service.endSession(TEST_USER_ID, TEST_SESSION_ID)

      expect(result).toEqual({ success: true })
      expect(mockAgentSessionRepo.endSession).toHaveBeenCalledWith(TEST_SESSION_ID)
    })

    it('存在しないセッションの場合NotFoundErrorを投げる', async () => {
      mockAgentSessionRepo.findById.mockResolvedValue(null)

      await expect(
        service.endSession(TEST_USER_ID, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError)
    })

    it('プロジェクトメンバーでない場合AuthorizationErrorを投げる', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        status: 'ACTIVE',
        project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
      }

      mockAgentSessionRepo.findById.mockResolvedValue(mockSession)
      mockAgentSessionRepo.isProjectMember.mockResolvedValue(false)

      await expect(
        service.endSession(TEST_USER_ID, TEST_SESSION_ID)
      ).rejects.toThrow(AuthorizationError)
    })

    it('既に終了済みの場合ValidationErrorを投げる', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        status: 'ENDED',
        project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
      }

      mockAgentSessionRepo.findById.mockResolvedValue(mockSession)
      mockAgentSessionRepo.isProjectMember.mockResolvedValue(true)

      await expect(
        service.endSession(TEST_USER_ID, TEST_SESSION_ID)
      ).rejects.toThrow(ValidationError)
    })

    it('TIMEOUTの場合もValidationErrorを投げる', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        status: 'TIMEOUT',
        project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
      }

      mockAgentSessionRepo.findById.mockResolvedValue(mockSession)
      mockAgentSessionRepo.isProjectMember.mockResolvedValue(true)

      await expect(
        service.endSession(TEST_USER_ID, TEST_SESSION_ID)
      ).rejects.toThrow(ValidationError)
    })
  })
})
