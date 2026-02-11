import { vi } from 'vitest';
import { WebSocket } from 'ws';
import type { AuthenticatedUser } from '../auth.js';

// テスト用の固定値
export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_USER_ID_2 = '22222222-2222-2222-2222-222222222222';
export const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';
export const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';
export const TEST_CASE_ID = '55555555-5555-5555-5555-555555555555';
export const TEST_EXECUTION_ID = '66666666-6666-6666-6666-666666666666';
export const TEST_LOCK_ID = '77777777-7777-7777-7777-777777777777';
export const TEST_ACCESS_TOKEN = 'valid-access-token';

// テスト用のユーザー
export const testUser: AuthenticatedUser = {
  id: TEST_USER_ID,
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
};

export const testUser2: AuthenticatedUser = {
  id: TEST_USER_ID_2,
  email: 'test2@example.com',
  name: 'Test User 2',
  avatarUrl: null,
};

// モックWebSocket
export interface MockWebSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  userId?: string;
  user?: AuthenticatedUser;
  channels: Set<string>;
  isAlive: boolean;
}

export function createMockWebSocket(overrides: Partial<MockWebSocket> = {}): MockWebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn(),
    channels: new Set<string>(),
    isAlive: true,
    ...overrides,
  };
}

// モックRedis
export const mockPublisher = {
  publish: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
};

export const mockSubscriber = {
  subscribe: vi.fn().mockResolvedValue(1),
  unsubscribe: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
};

// Redisモジュールのモック
export function createRedisMock() {
  return {
    publisher: mockPublisher,
    subscriber: mockSubscriber,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    subscribeToChannel: vi.fn().mockResolvedValue(true),
    unsubscribeFromChannel: vi.fn().mockResolvedValue(undefined),
    closeRedis: vi.fn().mockResolvedValue(undefined),
  };
}

// Prismaモック
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
};

// JWTペイロード
export const testJwtPayload = {
  sub: TEST_USER_ID,
  email: 'test@example.com',
  type: 'access' as const,
  jti: 'test-jwt-id',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
};

// 送信されたメッセージを取得するヘルパー
export function getSentMessages(mockWs: MockWebSocket): unknown[] {
  return mockWs.send.mock.calls.map((call) => {
    try {
      return JSON.parse(call[0] as string);
    } catch {
      return call[0];
    }
  });
}

// 特定のタイプのメッセージを取得するヘルパー
export function getSentMessagesByType(mockWs: MockWebSocket, type: string): unknown[] {
  return getSentMessages(mockWs).filter((msg) => {
    return typeof msg === 'object' && msg !== null && 'type' in msg && (msg as { type: string }).type === type;
  });
}
