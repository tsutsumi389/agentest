import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../lib/ws';
import { Channels } from '@agentest/ws-types';
import type {
  TestSuiteUpdatedEvent,
  TestCaseUpdatedEvent,
  ExecutionStartedEvent,
} from '@agentest/ws-types';

/**
 * テストスイートのリアルタイム更新を購読するフック
 * テストスイートの変更、テストケースの変更、実行開始イベントを監視し、
 * 関連するReact Queryキャッシュを自動的に無効化する
 */
export function useTestSuiteRealtime(testSuiteId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!testSuiteId) return;

    const channel = Channels.testSuite(testSuiteId);
    wsClient.subscribe([channel]);

    // テストスイート更新イベント
    const unsubSuiteUpdated = wsClient.on<TestSuiteUpdatedEvent>('test_suite:updated', (event) => {
      if (event.testSuiteId !== testSuiteId) return;

      // テストスイート基本情報を更新
      queryClient.invalidateQueries({ queryKey: ['test-suite', testSuiteId] });

      // 前提条件関連の変更があった場合
      const hasPreconditionChange = event.changes.some((c) => c.field.startsWith('precondition'));
      if (hasPreconditionChange) {
        queryClient.invalidateQueries({ queryKey: ['test-suite-preconditions', testSuiteId] });
      }

      // テストケース並び替えの変更があった場合
      const hasTestCaseReorder = event.changes.some((c) => c.field.startsWith('testCases'));
      if (hasTestCaseReorder) {
        queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      }

      // 変更履歴を更新
      queryClient.invalidateQueries({ queryKey: ['test-suite-histories', testSuiteId] });
    });

    // テストケース更新イベント（テストスイートチャンネル経由）
    const unsubCaseUpdated = wsClient.on<TestCaseUpdatedEvent>('test_case:updated', (event) => {
      if (event.testSuiteId !== testSuiteId) return;

      // テストケース詳細を更新
      queryClient.invalidateQueries({ queryKey: ['test-case-details', event.testCaseId] });
      // テストケース一覧を更新
      queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      // テストスイートの変更履歴を更新
      queryClient.invalidateQueries({ queryKey: ['test-suite-histories', testSuiteId] });
      // テストケースの変更履歴を更新
      queryClient.invalidateQueries({ queryKey: ['test-case-histories', event.testCaseId] });
    });

    // 実行開始イベント
    const unsubExecStarted = wsClient.on<ExecutionStartedEvent>('execution:started', (event) => {
      if (event.testSuiteId !== testSuiteId) return;
      queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
    });

    return () => {
      unsubSuiteUpdated();
      unsubCaseUpdated();
      unsubExecStarted();
      wsClient.unsubscribe([channel]);
    };
  }, [testSuiteId, queryClient]);
}
