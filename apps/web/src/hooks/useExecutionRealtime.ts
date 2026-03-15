import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../lib/ws';
import { Channels } from '@agentest/ws-types';
import type {
  ExecutionPreconditionUpdatedEvent,
  ExecutionStepUpdatedEvent,
  ExecutionExpectedResultUpdatedEvent,
  ExecutionEvidenceAddedEvent,
} from '@agentest/ws-types';
import type { ExecutionWithDetails } from '../lib/api';

/**
 * 実行結果のリアルタイム更新を購読するフック
 * 前提条件・ステップ・期待結果の更新、エビデンス追加を監視し、
 * React Queryキャッシュを自動的にパッチする
 */
export function useExecutionRealtime(executionId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!executionId) return;

    const channel = Channels.execution(executionId);
    const queryKey = ['execution', executionId, 'details'];

    wsClient.subscribe([channel]);

    // 前提条件更新 → キャッシュ内の該当結果のstatus/noteをパッチ
    const unsubPrecondition = wsClient.on<ExecutionPreconditionUpdatedEvent>(
      'execution:precondition_updated',
      (event) => {
        if (event.executionId !== executionId) return;
        queryClient.setQueryData<{ execution: ExecutionWithDetails }>(queryKey, (old) => {
          if (!old) return old;
          return {
            execution: {
              ...old.execution,
              preconditionResults: old.execution.preconditionResults.map((r) =>
                r.id === event.resultId ? { ...r, status: event.status, note: event.note } : r
              ),
            },
          };
        });
        // 実施者情報など完全データ取得のため、staleマークのみ（即時refetchなし）
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      }
    );

    // ステップ更新 → キャッシュ内の該当結果のstatus/noteをパッチ
    const unsubStep = wsClient.on<ExecutionStepUpdatedEvent>('execution:step_updated', (event) => {
      if (event.executionId !== executionId) return;
      queryClient.setQueryData<{ execution: ExecutionWithDetails }>(queryKey, (old) => {
        if (!old) return old;
        return {
          execution: {
            ...old.execution,
            stepResults: old.execution.stepResults.map((r) =>
              r.id === event.resultId ? { ...r, status: event.status, note: event.note } : r
            ),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
    });

    // 期待結果更新 → キャッシュ内の該当結果のstatus/noteをパッチ
    const unsubExpected = wsClient.on<ExecutionExpectedResultUpdatedEvent>(
      'execution:expected_result_updated',
      (event) => {
        if (event.executionId !== executionId) return;
        queryClient.setQueryData<{ execution: ExecutionWithDetails }>(queryKey, (old) => {
          if (!old) return old;
          return {
            execution: {
              ...old.execution,
              expectedResults: old.execution.expectedResults.map((r) =>
                r.id === event.resultId ? { ...r, status: event.status, note: event.note } : r
              ),
            },
          };
        });
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      }
    );

    // エビデンス追加 → downloadUrlが必要なため完全再取得
    const unsubEvidence = wsClient.on<ExecutionEvidenceAddedEvent>(
      'execution:evidence_added',
      (event) => {
        if (event.executionId !== executionId) return;
        queryClient.invalidateQueries({ queryKey });
      }
    );

    return () => {
      unsubPrecondition();
      unsubStep();
      unsubExpected();
      unsubEvidence();
      wsClient.unsubscribe([channel]);
    };
  }, [executionId, queryClient]);
}
