import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../lib/ws';
import { Channels } from '@agentest/ws-types';
import type { TestCaseUpdatedEvent } from '@agentest/ws-types';

/**
 * テストケースのリアルタイム更新を購読するフック
 * テストケースの変更イベントを監視し、関連するReact Queryキャッシュを自動的に無効化する
 */
export function useTestCaseRealtime(testCaseId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!testCaseId) return;

    const channel = Channels.testCase(testCaseId);
    wsClient.subscribe([channel]);

    // テストケース更新イベント
    const unsubCaseUpdated = wsClient.on<TestCaseUpdatedEvent>('test_case:updated', (event) => {
      if (event.testCaseId !== testCaseId) return;

      // テストケース詳細を更新
      queryClient.invalidateQueries({ queryKey: ['test-case-details', testCaseId] });
      // テストケースの変更履歴を更新
      queryClient.invalidateQueries({ queryKey: ['test-case-histories', testCaseId] });
    });

    return () => {
      unsubCaseUpdated();
      wsClient.unsubscribe([channel]);
    };
  }, [testCaseId, queryClient]);
}
