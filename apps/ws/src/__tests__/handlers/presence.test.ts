import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { testUser, testUser2, createMockWebSocket, getSentMessages } from '../helpers.js';
import {
  handlePresenceJoin,
  handlePresenceLeave,
  getChannelPresence,
} from '../../handlers/presence.js';

// crypto.randomUUIDをモック
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-1234',
});

describe('handlers/presence', () => {
  const TEST_CHANNEL = 'project:test-project';

  beforeEach(() => {
    // プレゼンス状態をリセット（モジュール状態のクリア）
    // getChannelPresenceを使って状態を確認し、リセットが必要なら対処
    vi.clearAllMocks();
  });

  describe('handlePresenceJoin', () => {
    it('新規ユーザーの参加でuser_joinedイベントを送信', async () => {
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      await handlePresenceJoin(TEST_CHANNEL, testUser, subscribers);

      const messages = getSentMessages(ws1);

      // user_joinedイベントが送信されていることを確認
      const joinedEvent = messages.find(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === 'presence:user_joined'
      );
      expect(joinedEvent).toBeDefined();
      expect(joinedEvent).toMatchObject({
        type: 'presence:user_joined',
        channel: TEST_CHANNEL,
        user: {
          id: testUser.id,
          name: testUser.name,
          avatarUrl: testUser.avatarUrl,
        },
      });
    });

    it('参加ユーザーにプレゼンスリストを送信', async () => {
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      await handlePresenceJoin(TEST_CHANNEL, testUser, subscribers);

      const messages = getSentMessages(ws1);

      // presence:listイベントが送信されていることを確認
      const listEvent = messages.find(
        (m) =>
          typeof m === 'object' && m !== null && (m as { type?: string }).type === 'presence:list'
      );
      expect(listEvent).toBeDefined();
      expect(listEvent).toMatchObject({
        type: 'presence:list',
        channel: TEST_CHANNEL,
      });
      expect((listEvent as { users: unknown[] }).users).toContainEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
      });
    });

    it('既存ユーザーの再参加ではuser_joinedを送信しない', async () => {
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      // 初回参加
      await handlePresenceJoin(TEST_CHANNEL, testUser, subscribers);
      ws1.send.mockClear();

      // 再参加（同じユーザー）
      await handlePresenceJoin(TEST_CHANNEL, testUser, subscribers);

      const messages = getSentMessages(ws1);

      // user_joinedイベントは送信されない
      const joinedEvent = messages.find(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === 'presence:user_joined'
      );
      expect(joinedEvent).toBeUndefined();

      // presence:listは送信される
      const listEvent = messages.find(
        (m) =>
          typeof m === 'object' && m !== null && (m as { type?: string }).type === 'presence:list'
      );
      expect(listEvent).toBeDefined();
    });

    it('閉じているWebSocketには送信しない', async () => {
      const ws1 = createMockWebSocket({
        userId: testUser.id,
        readyState: WebSocket.CLOSED,
      });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      await handlePresenceJoin(TEST_CHANNEL, testUser, subscribers);

      expect(ws1.send).not.toHaveBeenCalled();
    });

    it('複数のサブスクライバーに通知を送信', async () => {
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const ws2 = createMockWebSocket({ userId: testUser2.id });
      const subscribers = new Set([ws1 as unknown as WebSocket, ws2 as unknown as WebSocket]);

      // user2が先に参加
      await handlePresenceJoin(TEST_CHANNEL + '-multi', testUser2, subscribers);
      ws1.send.mockClear();
      ws2.send.mockClear();

      // user1が参加
      await handlePresenceJoin(TEST_CHANNEL + '-multi', testUser, subscribers);

      // 両方のWebSocketにuser_joinedが送信される
      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });
  });

  describe('handlePresenceLeave', () => {
    it('ユーザー離脱でuser_leftイベントを送信', async () => {
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const ws2 = createMockWebSocket({ userId: testUser2.id });
      const leaveChannel = TEST_CHANNEL + '-leave';

      // 両ユーザーが参加
      const allSubscribers = new Set([ws1 as unknown as WebSocket, ws2 as unknown as WebSocket]);
      await handlePresenceJoin(leaveChannel, testUser, allSubscribers);
      await handlePresenceJoin(leaveChannel, testUser2, allSubscribers);
      ws1.send.mockClear();
      ws2.send.mockClear();

      // user1が離脱（ws1を除いたsubscribersで呼び出す）
      const remainingSubscribers = new Set([ws2 as unknown as WebSocket]);
      await handlePresenceLeave(leaveChannel, testUser.id, remainingSubscribers);

      // 残っているuser2にuser_leftイベントが送信される
      const messages = getSentMessages(ws2);
      const leftEvent = messages.find(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === 'presence:user_left'
      );
      expect(leftEvent).toBeDefined();
      expect(leftEvent).toMatchObject({
        type: 'presence:user_left',
        channel: leaveChannel,
        userId: testUser.id,
      });
    });

    it('他に接続がある場合はuser_leftを送信しない', async () => {
      // 同じユーザーが複数の接続を持つケース
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const ws2 = createMockWebSocket({ userId: testUser.id }); // 同じユーザー
      const multiConnChannel = TEST_CHANNEL + '-multiconn';

      const subscribers = new Set([ws1 as unknown as WebSocket, ws2 as unknown as WebSocket]);
      await handlePresenceJoin(multiConnChannel, testUser, subscribers);
      ws1.send.mockClear();
      ws2.send.mockClear();

      // ws1が離脱してもws2がまだあるのでuser_leftは送信されない
      const remainingSubscribers = new Set([ws2 as unknown as WebSocket]);
      await handlePresenceLeave(multiConnChannel, testUser.id, remainingSubscribers);

      // user_leftイベントは送信されない
      const messages = getSentMessages(ws2);
      const leftEvent = messages.find(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === 'presence:user_left'
      );
      expect(leftEvent).toBeUndefined();
    });

    it('存在しないチャンネルからの離脱はエラーにならない', async () => {
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      // 参加していないチャンネルから離脱
      await expect(
        handlePresenceLeave('non-existent-channel', testUser.id, subscribers)
      ).resolves.not.toThrow();
    });

    it('空のsubscribersでもエラーにならない', async () => {
      const emptyChannel = TEST_CHANNEL + '-empty';
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      await handlePresenceJoin(emptyChannel, testUser, subscribers);

      const emptySubscribers = new Set<WebSocket>();
      await expect(
        handlePresenceLeave(emptyChannel, testUser.id, emptySubscribers)
      ).resolves.not.toThrow();
    });
  });

  describe('getChannelPresence', () => {
    it('チャンネルのプレゼンスリストを取得', async () => {
      const presenceChannel = TEST_CHANNEL + '-presence';
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const subscribers = new Set([ws1 as unknown as WebSocket]);

      await handlePresenceJoin(presenceChannel, testUser, subscribers);

      const presence = getChannelPresence(presenceChannel);
      expect(presence).toContainEqual(testUser);
    });

    it('存在しないチャンネルは空配列を返す', () => {
      const presence = getChannelPresence('non-existent-channel-123');
      expect(presence).toEqual([]);
    });

    it('複数ユーザーのプレゼンスを取得', async () => {
      const multiPresenceChannel = TEST_CHANNEL + '-multi-presence';
      const ws1 = createMockWebSocket({ userId: testUser.id });
      const ws2 = createMockWebSocket({ userId: testUser2.id });
      const subscribers = new Set([ws1 as unknown as WebSocket, ws2 as unknown as WebSocket]);

      await handlePresenceJoin(multiPresenceChannel, testUser, subscribers);
      await handlePresenceJoin(multiPresenceChannel, testUser2, subscribers);

      const presence = getChannelPresence(multiPresenceChannel);
      expect(presence).toHaveLength(2);
      expect(presence).toContainEqual(testUser);
      expect(presence).toContainEqual(testUser2);
    });
  });
});
