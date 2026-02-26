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
  findOAuthSessions: vi.fn(),
  findOAuthTokenById: vi.fn(),
  revokeOAuthToken: vi.fn(),
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
    it('AgentSessionとOAuthトークンを統合して返す', async () => {
      const now = new Date()
      const mockSessions = [
        {
          id: TEST_SESSION_ID,
          projectId: TEST_PROJECT_ID,
          clientId: 'claude-code-xxx',
          clientName: 'Claude Code',
          status: 'ACTIVE',
          startedAt: now,
          lastHeartbeat: now,
          endedAt: null,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
        },
      ]
      const mockOAuthTokens = [
        {
          id: 'oauth-token-1',
          userId: TEST_USER_ID,
          clientId: 'oauth-client-id',
          scopes: ['mcp:read'],
          expiresAt: new Date(Date.now() + 3600000), // 1時間後
          revokedAt: null,
          createdAt: now,
          client: { clientId: 'oauth-client-id', clientName: 'Claude Code (agentest)' },
        },
      ]

      mockAgentSessionRepo.findByUserProjects.mockResolvedValue({
        sessions: mockSessions,
        total: 1,
      })
      mockAgentSessionRepo.findOAuthSessions.mockResolvedValue(mockOAuthTokens)

      const result = await service.getSessionsByUser({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE'],
        page: 1,
        limit: 50,
      })

      expect(result.sessions).toHaveLength(2)
      expect(result.total).toBe(2)

      // AgentSession
      const agentSession = result.sessions.find((s) => s.source === 'agent')
      expect(agentSession).toEqual(
        expect.objectContaining({
          id: TEST_SESSION_ID,
          source: 'agent',
          projectName: 'テストプロジェクト',
        })
      )

      // OAuthセッション
      const oauthSession = result.sessions.find((s) => s.source === 'oauth')
      expect(oauthSession).toEqual(
        expect.objectContaining({
          id: 'oauth-token-1',
          source: 'oauth',
          clientName: 'Claude Code (agentest)',
          status: 'ACTIVE',
          projectId: null,
          projectName: null,
        })
      )
    })

    it('OAuthトークンのステータスが正しく判定される', async () => {
      const now = new Date()
      mockAgentSessionRepo.findByUserProjects.mockResolvedValue({ sessions: [], total: 0 })
      mockAgentSessionRepo.findOAuthSessions.mockResolvedValue([
        {
          id: 'token-active',
          userId: TEST_USER_ID,
          clientId: 'c1',
          scopes: [],
          expiresAt: new Date(Date.now() + 3600000),
          revokedAt: null,
          createdAt: now,
          client: { clientId: 'c1', clientName: 'Active' },
        },
        {
          id: 'token-revoked',
          userId: TEST_USER_ID,
          clientId: 'c2',
          scopes: [],
          expiresAt: new Date(Date.now() + 3600000),
          revokedAt: new Date(),
          createdAt: now,
          client: { clientId: 'c2', clientName: 'Revoked' },
        },
        {
          id: 'token-expired',
          userId: TEST_USER_ID,
          clientId: 'c3',
          scopes: [],
          expiresAt: new Date(Date.now() - 1000),
          revokedAt: null,
          createdAt: now,
          client: { clientId: 'c3', clientName: 'Expired' },
        },
      ])

      const result = await service.getSessionsByUser({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE', 'ENDED', 'TIMEOUT'],
        page: 1,
        limit: 50,
      })

      const sessions = result.sessions
      expect(sessions.find((s) => s.id === 'token-active')?.status).toBe('ACTIVE')
      expect(sessions.find((s) => s.id === 'token-revoked')?.status).toBe('ENDED')
      expect(sessions.find((s) => s.id === 'token-expired')?.status).toBe('TIMEOUT')
    })

    it('AgentSessionのみの場合（OAuthトークンなし）', async () => {
      mockAgentSessionRepo.findByUserProjects.mockResolvedValue({
        sessions: [{
          id: TEST_SESSION_ID,
          projectId: TEST_PROJECT_ID,
          clientId: 'client-1',
          clientName: null,
          status: 'IDLE',
          startedAt: new Date('2025-01-01'),
          lastHeartbeat: new Date('2025-01-01'),
          endedAt: null,
          project: { id: TEST_PROJECT_ID, name: 'Project A' },
        }],
        total: 1,
      })
      mockAgentSessionRepo.findOAuthSessions.mockResolvedValue([])

      const result = await service.getSessionsByUser({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE'],
        page: 1,
        limit: 50,
      })

      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0]).toHaveProperty('source', 'agent')
      expect(result.sessions[0]).toHaveProperty('projectName', 'Project A')
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
      mockAgentSessionRepo.findOAuthTokenById.mockResolvedValue(null)

      await expect(
        service.endSession(TEST_USER_ID, 'nonexistent-id')
      ).rejects.toThrow(NotFoundError)
    })

    it('OAuthトークンを失効させる', async () => {
      const mockToken = {
        id: 'oauth-token-1',
        userId: TEST_USER_ID,
        clientId: 'client-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        client: { clientId: 'client-id', clientName: 'Claude Code' },
      }

      mockAgentSessionRepo.findById.mockResolvedValue(null)
      mockAgentSessionRepo.findOAuthTokenById.mockResolvedValue(mockToken)
      mockAgentSessionRepo.revokeOAuthToken.mockResolvedValue({ ...mockToken, revokedAt: new Date() })

      const result = await service.endSession(TEST_USER_ID, 'oauth-token-1')

      expect(result).toEqual({ success: true })
      expect(mockAgentSessionRepo.revokeOAuthToken).toHaveBeenCalledWith('oauth-token-1')
    })

    it('他人のOAuthトークンは失効できない', async () => {
      const mockToken = {
        id: 'oauth-token-1',
        userId: 'other-user-id',
        clientId: 'client-id',
        revokedAt: null,
        client: { clientId: 'client-id', clientName: 'Claude Code' },
      }

      mockAgentSessionRepo.findById.mockResolvedValue(null)
      mockAgentSessionRepo.findOAuthTokenById.mockResolvedValue(mockToken)

      await expect(
        service.endSession(TEST_USER_ID, 'oauth-token-1')
      ).rejects.toThrow(AuthorizationError)
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
