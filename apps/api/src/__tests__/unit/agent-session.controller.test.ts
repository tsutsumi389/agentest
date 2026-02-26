import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { AuthenticationError, ValidationError } from '@agentest/shared'

// Service モック
const mockAgentSessionService = vi.hoisted(() => ({
  parseStatuses: vi.fn(),
  getSessionsByUser: vi.fn(),
  endSession: vi.fn(),
}))

vi.mock('../../services/agent-session.service.js', () => ({
  AgentSessionService: vi.fn().mockImplementation(() => mockAgentSessionService),
}))

import { AgentSessionController } from '../../controllers/agent-session.controller.js'

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'
const TEST_SESSION_ID = '33333333-3333-3333-3333-333333333333'

const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: {},
  query: {},
  ...overrides,
})

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {}
  res.json = vi.fn().mockReturnValue(res)
  res.status = vi.fn().mockReturnValue(res)
  return res
}

describe('AgentSessionController', () => {
  let controller: AgentSessionController
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new AgentSessionController()
    mockNext = vi.fn()
  })

  describe('getSessions', () => {
    it('セッション一覧を返す', async () => {
      const req = mockRequest({ query: { status: 'ACTIVE,IDLE', page: '1', limit: '50' } }) as Request
      const res = mockResponse() as Response

      mockAgentSessionService.parseStatuses.mockReturnValue(['ACTIVE', 'IDLE'])
      mockAgentSessionService.getSessionsByUser.mockResolvedValue({
        sessions: [{ id: TEST_SESSION_ID }],
        total: 1,
      })

      await controller.getSessions(req, res, mockNext)

      expect(res.json).toHaveBeenCalledWith({
        data: [{ id: TEST_SESSION_ID }],
        meta: { total: 1, page: 1, limit: 50 },
      })
    })

    it('デフォルトのページネーションパラメータを使用する', async () => {
      const req = mockRequest({ query: {} }) as Request
      const res = mockResponse() as Response

      mockAgentSessionService.parseStatuses.mockReturnValue(['ACTIVE', 'IDLE'])
      mockAgentSessionService.getSessionsByUser.mockResolvedValue({
        sessions: [],
        total: 0,
      })

      await controller.getSessions(req, res, mockNext)

      expect(mockAgentSessionService.getSessionsByUser).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE'],
        page: 1,
        limit: 50,
      })
    })

    it('limitの上限を100に制限する', async () => {
      const req = mockRequest({ query: { limit: '999' } }) as Request
      const res = mockResponse() as Response

      mockAgentSessionService.parseStatuses.mockReturnValue(['ACTIVE', 'IDLE'])
      mockAgentSessionService.getSessionsByUser.mockResolvedValue({
        sessions: [],
        total: 0,
      })

      await controller.getSessions(req, res, mockNext)

      expect(mockAgentSessionService.getSessionsByUser).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      )
    })

    it('未認証の場合AuthenticationErrorをnextに渡す', async () => {
      const req = mockRequest({ user: undefined }) as Request
      const res = mockResponse() as Response

      await controller.getSessions(req, res, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError))
    })

    it('エラー時にnextに渡す', async () => {
      const req = mockRequest() as Request
      const res = mockResponse() as Response
      const error = new Error('DB error')

      mockAgentSessionService.parseStatuses.mockReturnValue(['ACTIVE', 'IDLE'])
      mockAgentSessionService.getSessionsByUser.mockRejectedValue(error)

      await controller.getSessions(req, res, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  describe('endSession', () => {
    it('セッションを終了する', async () => {
      const req = mockRequest({ params: { sessionId: TEST_SESSION_ID } }) as Request
      const res = mockResponse() as Response

      mockAgentSessionService.endSession.mockResolvedValue({ success: true })

      await controller.endSession(req, res, mockNext)

      expect(res.json).toHaveBeenCalledWith({ data: { success: true } })
      expect(mockAgentSessionService.endSession).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_SESSION_ID
      )
    })

    it('sessionIdが未指定の場合ValidationErrorをnextに渡す', async () => {
      const req = mockRequest({ params: {} }) as Request
      const res = mockResponse() as Response

      await controller.endSession(req, res, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError))
    })

    it('未認証の場合AuthenticationErrorをnextに渡す', async () => {
      const req = mockRequest({ user: undefined, params: { sessionId: TEST_SESSION_ID } }) as Request
      const res = mockResponse() as Response

      await controller.endSession(req, res, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError))
    })

    it('エラー時にnextに渡す', async () => {
      const req = mockRequest({ params: { sessionId: TEST_SESSION_ID } }) as Request
      const res = mockResponse() as Response
      const error = new Error('Service error')

      mockAgentSessionService.endSession.mockRejectedValue(error)

      await controller.endSession(req, res, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })
})
