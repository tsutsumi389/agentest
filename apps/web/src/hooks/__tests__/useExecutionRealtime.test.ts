import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ExecutionWithDetails } from '../../lib/api';

// wsClientのモック
const { mockWsClient } = vi.hoisted(() => {
  const mockWsClient = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn().mockReturnValue(vi.fn()), // unsubscribe関数を返す
  };
  return { mockWsClient };
});

vi.mock('../../lib/ws', () => ({
  wsClient: mockWsClient,
}));

import { useExecutionRealtime } from '../useExecutionRealtime';

// テスト用QueryClientを作成
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

// テスト用ラッパー
function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

// 型安全なハンドラ取得ヘルパー
function getEventHandler(eventType: string): (event: unknown) => void {
  const call = mockWsClient.on.mock.calls.find(
    (c: unknown[]) => c[0] === eventType
  );
  if (!call) throw new Error(`No handler registered for ${eventType}`);
  return call[1] as (event: unknown) => void;
}

describe('useExecutionRealtime', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('executionIdがundefinedの場合は購読しない', () => {
    renderHook(() => useExecutionRealtime(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockWsClient.subscribe).not.toHaveBeenCalled();
    expect(mockWsClient.on).not.toHaveBeenCalled();
  });

  it('execution:{executionId}チャンネルを購読する', () => {
    renderHook(() => useExecutionRealtime('exec-1'), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockWsClient.subscribe).toHaveBeenCalledWith(['execution:exec-1']);
  });

  it('4種類のイベントハンドラを登録する', () => {
    renderHook(() => useExecutionRealtime('exec-1'), {
      wrapper: createWrapper(queryClient),
    });

    const registeredEvents = mockWsClient.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('execution:precondition_updated');
    expect(registeredEvents).toContain('execution:step_updated');
    expect(registeredEvents).toContain('execution:expected_result_updated');
    expect(registeredEvents).toContain('execution:evidence_added');
  });

  it('アンマウント時にunsubscribeとイベント解除が呼ばれる', () => {
    const mockUnsub1 = vi.fn();
    const mockUnsub2 = vi.fn();
    const mockUnsub3 = vi.fn();
    const mockUnsub4 = vi.fn();
    mockWsClient.on
      .mockReturnValueOnce(mockUnsub1)
      .mockReturnValueOnce(mockUnsub2)
      .mockReturnValueOnce(mockUnsub3)
      .mockReturnValueOnce(mockUnsub4);

    const { unmount } = renderHook(() => useExecutionRealtime('exec-1'), {
      wrapper: createWrapper(queryClient),
    });

    unmount();

    expect(mockUnsub1).toHaveBeenCalled();
    expect(mockUnsub2).toHaveBeenCalled();
    expect(mockUnsub3).toHaveBeenCalled();
    expect(mockUnsub4).toHaveBeenCalled();
    expect(mockWsClient.unsubscribe).toHaveBeenCalledWith(['execution:exec-1']);
  });

  describe('precondition_updatedイベント', () => {
    it('キャッシュ内の該当前提条件結果のstatus/noteを更新する', () => {
      // キャッシュにデータをセット
      const mockExecution = {
        execution: {
          preconditionResults: [
            { id: 'pr-1', status: 'UNCHECKED', note: null },
            { id: 'pr-2', status: 'UNCHECKED', note: null },
          ],
          stepResults: [],
          expectedResults: [],
        } as unknown as ExecutionWithDetails,
      };
      queryClient.setQueryData(['execution', 'exec-1', 'details'], mockExecution);

      renderHook(() => useExecutionRealtime('exec-1'), {
        wrapper: createWrapper(queryClient),
      });

      // イベントハンドラを取得して実行
      const handler = getEventHandler('execution:precondition_updated');
      handler({
        type: 'execution:precondition_updated',
        executionId: 'exec-1',
        resultId: 'pr-1',
        snapshotPreconditionId: 'snap-1',
        status: 'OK',
        note: '確認済み',
        eventId: 'ev-1',
        timestamp: Date.now(),
      });

      // キャッシュが更新されていることを確認
      const cached = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', 'exec-1', 'details']);
      expect(cached?.execution.preconditionResults[0]).toMatchObject({
        id: 'pr-1',
        status: 'OK',
        note: '確認済み',
      });
      // 他の結果は変更されない
      expect(cached?.execution.preconditionResults[1]).toMatchObject({
        id: 'pr-2',
        status: 'UNCHECKED',
        note: null,
      });
    });

    it('異なるexecutionIdのイベントは無視する', () => {
      const mockExecution = {
        execution: {
          preconditionResults: [{ id: 'pr-1', status: 'UNCHECKED', note: null }],
          stepResults: [],
          expectedResults: [],
        } as unknown as ExecutionWithDetails,
      };
      queryClient.setQueryData(['execution', 'exec-1', 'details'], mockExecution);

      renderHook(() => useExecutionRealtime('exec-1'), {
        wrapper: createWrapper(queryClient),
      });

      const handler = getEventHandler('execution:precondition_updated');
      handler({
        type: 'execution:precondition_updated',
        executionId: 'exec-OTHER',
        resultId: 'pr-1',
        snapshotPreconditionId: 'snap-1',
        status: 'OK',
        note: '変更されないはず',
        eventId: 'ev-1',
        timestamp: Date.now(),
      });

      const cached = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', 'exec-1', 'details']);
      expect(cached?.execution.preconditionResults[0].status).toBe('UNCHECKED');
    });
  });

  describe('step_updatedイベント', () => {
    it('キャッシュ内の該当ステップ結果のstatus/noteを更新する', () => {
      const mockExecution = {
        execution: {
          preconditionResults: [],
          stepResults: [
            { id: 'sr-1', status: 'PENDING', note: null },
          ],
          expectedResults: [],
        } as unknown as ExecutionWithDetails,
      };
      queryClient.setQueryData(['execution', 'exec-1', 'details'], mockExecution);

      renderHook(() => useExecutionRealtime('exec-1'), {
        wrapper: createWrapper(queryClient),
      });

      const handler = getEventHandler('execution:step_updated');
      handler({
        type: 'execution:step_updated',
        executionId: 'exec-1',
        resultId: 'sr-1',
        snapshotTestCaseId: 'snap-tc-1',
        snapshotStepId: 'snap-step-1',
        status: 'PASSED',
        note: '手順実行完了',
        eventId: 'ev-2',
        timestamp: Date.now(),
      });

      const cached = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', 'exec-1', 'details']);
      expect(cached?.execution.stepResults[0]).toMatchObject({
        id: 'sr-1',
        status: 'PASSED',
        note: '手順実行完了',
      });
    });
  });

  describe('expected_result_updatedイベント', () => {
    it('キャッシュ内の該当期待結果のstatus/noteを更新する', () => {
      const mockExecution = {
        execution: {
          preconditionResults: [],
          stepResults: [],
          expectedResults: [
            { id: 'er-1', status: 'PENDING', note: null, evidences: [] },
          ],
        } as unknown as ExecutionWithDetails,
      };
      queryClient.setQueryData(['execution', 'exec-1', 'details'], mockExecution);

      renderHook(() => useExecutionRealtime('exec-1'), {
        wrapper: createWrapper(queryClient),
      });

      const handler = getEventHandler('execution:expected_result_updated');
      handler({
        type: 'execution:expected_result_updated',
        executionId: 'exec-1',
        resultId: 'er-1',
        snapshotTestCaseId: 'snap-tc-1',
        snapshotExpectedResultId: 'snap-er-1',
        status: 'PASS',
        note: '期待通り',
        eventId: 'ev-3',
        timestamp: Date.now(),
      });

      const cached = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', 'exec-1', 'details']);
      expect(cached?.execution.expectedResults[0]).toMatchObject({
        id: 'er-1',
        status: 'PASS',
        note: '期待通り',
      });
    });
  });

  describe('evidence_addedイベント', () => {
    it('キャッシュを無効化してデータの再取得をトリガーする', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderHook(() => useExecutionRealtime('exec-1'), {
        wrapper: createWrapper(queryClient),
      });

      const handler = getEventHandler('execution:evidence_added');
      handler({
        type: 'execution:evidence_added',
        executionId: 'exec-1',
        expectedResultId: 'er-1',
        evidence: {
          id: 'ev-1',
          fileName: 'screenshot.png',
          fileUrl: 'evidences/exec-1/er-1/abc_screenshot.png',
          fileType: 'image/png',
        },
        eventId: 'ev-4',
        timestamp: Date.now(),
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['execution', 'exec-1', 'details'],
      });
    });

    it('異なるexecutionIdのイベントは無視する', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderHook(() => useExecutionRealtime('exec-1'), {
        wrapper: createWrapper(queryClient),
      });

      const handler = getEventHandler('execution:evidence_added');
      handler({
        type: 'execution:evidence_added',
        executionId: 'exec-OTHER',
        expectedResultId: 'er-1',
        evidence: {
          id: 'ev-1',
          fileName: 'screenshot.png',
          fileUrl: 'path/to/file',
          fileType: 'image/png',
        },
        eventId: 'ev-5',
        timestamp: Date.now(),
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
