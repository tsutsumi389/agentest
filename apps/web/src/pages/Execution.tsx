import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  executionsApi,
  type ExecutionWithDetails,
  type ExecutionEvidence,
  type PreconditionResultStatus,
  type StepResultStatus,
  type ExpectedResultStatus,
} from '../lib/api';
import { toast } from '../stores/toast';
import { usePageSidebar } from '../components/Layout';
import { usePictureInPicture } from '../hooks/usePictureInPicture';
import { ExecutionSidebar } from '../components/execution/ExecutionSidebar';
import { ExecutionOverviewPanel } from '../components/execution/ExecutionOverviewPanel';
import { ExecutionTestCaseDetailPanel } from '../components/execution/ExecutionTestCaseDetailPanel';
import { PipPortal } from '../components/execution/PipPortal';
import { PipExecutionPanel } from '../components/execution/PipExecutionPanel';

/**
 * 実行ページ
 * サイドバー + メインパネル構成
 */
export function ExecutionPage() {
  const { executionId } = useParams<{ executionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { setSidebarContent } = usePageSidebar();

  // Picture-in-Picture機能
  const { pipWindow, isPipSupported, isPipActive, openPip, closePip } = usePictureInPicture({
    width: 450,
    height: 650,
  });

  // URLパラメータから選択中のテストケースIDを取得
  const selectedTestCaseId = searchParams.get('testCase');

  // 更新中の結果IDを管理
  const [updatingPreconditionStatusId, setUpdatingPreconditionStatusId] = useState<string | null>(null);
  const [updatingPreconditionNoteId, setUpdatingPreconditionNoteId] = useState<string | null>(null);
  const [updatingStepStatusId, setUpdatingStepStatusId] = useState<string | null>(null);
  const [updatingStepNoteId, setUpdatingStepNoteId] = useState<string | null>(null);
  const [updatingExpectedStatusId, setUpdatingExpectedStatusId] = useState<string | null>(null);
  const [updatingExpectedNoteId, setUpdatingExpectedNoteId] = useState<string | null>(null);
  // エビデンス関連の状態
  const [uploadingEvidenceResultId, setUploadingEvidenceResultId] = useState<string | null>(null);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState<string | null>(null);

  // 実行詳細を取得（スナップショット、全結果データ含む）
  const { data, isLoading } = useQuery({
    queryKey: ['execution', executionId, 'details'],
    queryFn: () => executionsApi.getByIdWithDetails(executionId!),
    enabled: !!executionId,
  });

  const execution = data?.execution;

  // テストケース選択ハンドラ
  const handleTestCaseSelect = useCallback((testCaseId: string | null) => {
    if (testCaseId) {
      setSearchParams({ testCase: testCaseId });
    } else {
      setSearchParams({});
    }
  }, [setSearchParams]);

  // サイドバーを設定
  useEffect(() => {
    if (execution) {
      setSidebarContent(
        <ExecutionSidebar
          testCases={execution.executionTestSuite?.testCases ?? []}
          selectedTestCaseId={selectedTestCaseId}
          onSelect={handleTestCaseSelect}
          allExpectedResults={execution.expectedResults}
          isLoading={false}
        />
      );
    } else if (isLoading) {
      setSidebarContent(
        <div className="flex items-center justify-center h-full">
          <div className="text-foreground-muted">読み込み中...</div>
        </div>
      );
    }

    // クリーンアップ: ページ離脱時にサイドバーをクリア
    return () => {
      setSidebarContent(null);
    };
  }, [execution, selectedTestCaseId, isLoading, setSidebarContent, handleTestCaseSelect]);

  // 前提条件結果更新（楽観的更新）
  const updatePreconditionMutation = useMutation({
    mutationFn: ({ resultId, status, note }: { resultId: string; status: PreconditionResultStatus; note: string | null }) =>
      executionsApi.updatePreconditionResult(executionId!, resultId, {
        status,
        note: note ?? undefined,
      }),
    onMutate: async ({ resultId, status, note }) => {
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            preconditionResults: previousData.execution.preconditionResults.map((r) =>
              r.id === resultId ? { ...r, status, note } : r
            ),
          },
        });
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('前提条件の更新に失敗しました');
    },
    onSettled: () => {
      setUpdatingPreconditionStatusId(null);
      setUpdatingPreconditionNoteId(null);
    },
  });

  // ステップ結果更新（楽観的更新）
  const updateStepMutation = useMutation({
    mutationFn: ({ resultId, status, note }: { resultId: string; status: StepResultStatus; note: string | null }) =>
      executionsApi.updateStepResult(executionId!, resultId, {
        status,
        note: note ?? undefined,
      }),
    onMutate: async ({ resultId, status, note }) => {
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            stepResults: previousData.execution.stepResults.map((r) =>
              r.id === resultId ? { ...r, status, note } : r
            ),
          },
        });
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('ステップの更新に失敗しました');
    },
    onSettled: () => {
      setUpdatingStepStatusId(null);
      setUpdatingStepNoteId(null);
    },
  });

  // 期待結果更新（楽観的更新）
  const updateExpectedMutation = useMutation({
    mutationFn: ({ resultId, status, note }: { resultId: string; status: ExpectedResultStatus; note: string | null }) =>
      executionsApi.updateExpectedResult(executionId!, resultId, {
        status,
        note: note ?? undefined,
      }),
    onMutate: async ({ resultId, status, note }) => {
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            expectedResults: previousData.execution.expectedResults.map((r) =>
              r.id === resultId ? { ...r, status, note } : r
            ),
          },
        });
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('期待結果の更新に失敗しました');
    },
    onSettled: () => {
      setUpdatingExpectedStatusId(null);
      setUpdatingExpectedNoteId(null);
    },
  });

  // エビデンスアップロード
  const uploadEvidenceMutation = useMutation({
    mutationFn: ({ expectedResultId, file, description }: { expectedResultId: string; file: File; description?: string }) =>
      executionsApi.uploadEvidence(executionId!, expectedResultId, file, description),
    onMutate: async ({ expectedResultId }) => {
      setUploadingEvidenceResultId(expectedResultId);
    },
    onSuccess: (data, { expectedResultId }) => {
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);
      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            expectedResults: previousData.execution.expectedResults.map((r) =>
              r.id === expectedResultId
                ? { ...r, evidences: [...r.evidences, data.evidence] }
                : r
            ),
          },
        });
      }
      toast.success('エビデンスをアップロードしました');
    },
    onError: () => {
      toast.error('エビデンスのアップロードに失敗しました');
    },
    onSettled: () => {
      setUploadingEvidenceResultId(null);
    },
  });

  // エビデンス削除（楽観的更新）
  const deleteEvidenceMutation = useMutation({
    mutationFn: (evidenceId: string) => executionsApi.deleteEvidence(executionId!, evidenceId),
    onMutate: async (evidenceId) => {
      setDeletingEvidenceId(evidenceId);
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            expectedResults: previousData.execution.expectedResults.map((r) => ({
              ...r,
              evidences: r.evidences.filter((e: ExecutionEvidence) => e.id !== evidenceId),
            })),
          },
        });
      }

      return { previousData };
    },
    onSuccess: () => {
      toast.success('エビデンスを削除しました');
    },
    onError: (_error, _evidenceId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('エビデンスの削除に失敗しました');
    },
    onSettled: () => {
      setDeletingEvidenceId(null);
    },
  });

  // ハンドラー
  const handlePreconditionStatusChange = (resultId: string, status: PreconditionResultStatus) => {
    const current = execution?.preconditionResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingPreconditionStatusId(resultId);
    updatePreconditionMutation.mutate({ resultId, status, note: current.note });
  };

  const handlePreconditionNoteChange = (resultId: string, note: string | null) => {
    const current = execution?.preconditionResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingPreconditionNoteId(resultId);
    updatePreconditionMutation.mutate({ resultId, status: current.status, note });
  };

  const handleStepStatusChange = (resultId: string, status: StepResultStatus) => {
    const current = execution?.stepResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingStepStatusId(resultId);
    updateStepMutation.mutate({ resultId, status, note: current.note });
  };

  const handleStepNoteChange = (resultId: string, note: string | null) => {
    const current = execution?.stepResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingStepNoteId(resultId);
    updateStepMutation.mutate({ resultId, status: current.status, note });
  };

  const handleExpectedStatusChange = (resultId: string, status: ExpectedResultStatus) => {
    const current = execution?.expectedResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingExpectedStatusId(resultId);
    updateExpectedMutation.mutate({ resultId, status, note: current.note });
  };

  const handleExpectedNoteChange = (resultId: string, note: string | null) => {
    const current = execution?.expectedResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingExpectedNoteId(resultId);
    updateExpectedMutation.mutate({ resultId, status: current.status, note });
  };

  const handleEvidenceUpload = (expectedResultId: string, file: File, description?: string) => {
    uploadEvidenceMutation.mutate({ expectedResultId, file, description });
  };

  const handleEvidenceDelete = (evidenceId: string) => {
    deleteEvidenceMutation.mutate(evidenceId);
  };

  const handleEvidenceDownload = async (evidenceId: string) => {
    try {
      setDownloadingEvidenceId(evidenceId);
      const { downloadUrl } = await executionsApi.getEvidenceDownloadUrl(executionId!, evidenceId);
      window.open(downloadUrl, '_blank');
    } catch {
      toast.error('ダウンロードURLの取得に失敗しました');
    } finally {
      setDownloadingEvidenceId(null);
    }
  };

  // ソート済みテストケースリスト
  const sortedTestCases = useMemo(() => {
    if (!execution?.executionTestSuite) return [];
    return [...execution.executionTestSuite.testCases].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
  }, [execution?.executionTestSuite]);

  // 選択中のテストケースを取得
  const selectedTestCase = useMemo(() => {
    if (!selectedTestCaseId || !execution?.executionTestSuite) return null;
    return execution.executionTestSuite.testCases.find((tc) => tc.id === selectedTestCaseId) ?? null;
  }, [selectedTestCaseId, execution?.executionTestSuite]);

  // 現在のテストケースインデックス
  const currentTestCaseIndex = useMemo(() => {
    if (!selectedTestCaseId) return -1;
    return sortedTestCases.findIndex((tc) => tc.id === selectedTestCaseId);
  }, [selectedTestCaseId, sortedTestCases]);

  // テストケースナビゲーションハンドラ
  const handleNavigateToTestCase = useCallback((direction: 'prev' | 'next') => {
    if (currentTestCaseIndex < 0) return;
    const newIndex = direction === 'prev' ? currentTestCaseIndex - 1 : currentTestCaseIndex + 1;
    if (newIndex >= 0 && newIndex < sortedTestCases.length) {
      handleTestCaseSelect(sortedTestCases[newIndex].id);
    }
  }, [currentTestCaseIndex, sortedTestCases, handleTestCaseSelect]);

  // 選択中のテストケースに紐づく結果を取得
  const selectedTestCaseResults = useMemo(() => {
    if (!selectedTestCaseId || !execution) {
      return { preconditionResults: [], stepResults: [], expectedResults: [] };
    }
    return {
      preconditionResults: execution.preconditionResults.filter(
        (r) => r.executionTestCaseId === selectedTestCaseId
      ),
      stepResults: execution.stepResults.filter(
        (r) => r.executionTestCaseId === selectedTestCaseId
      ),
      expectedResults: execution.expectedResults.filter(
        (r) => r.executionTestCaseId === selectedTestCaseId
      ),
    };
  }, [selectedTestCaseId, execution]);

  // スイートレベル前提条件（executionTestCaseId = null）
  const suitePreconditionResults = useMemo(() => {
    if (!execution) return [];
    return execution.preconditionResults.filter((r) => r.executionTestCaseId === null);
  }, [execution]);

  // PiP表示用のテストケース（選択中がなければ1番目を使用）
  const pipTestCase = useMemo(() => {
    return selectedTestCase ?? sortedTestCases[0] ?? null;
  }, [selectedTestCase, sortedTestCases]);

  // PiP表示用のテストケース結果
  const pipTestCaseResults = useMemo(() => {
    if (!pipTestCase || !execution) {
      return { preconditionResults: [], stepResults: [], expectedResults: [] };
    }
    return {
      preconditionResults: execution.preconditionResults.filter(
        (r) => r.executionTestCaseId === pipTestCase.id
      ),
      stepResults: execution.stepResults.filter(
        (r) => r.executionTestCaseId === pipTestCase.id
      ),
      expectedResults: execution.expectedResults.filter(
        (r) => r.executionTestCaseId === pipTestCase.id
      ),
    };
  }, [pipTestCase, execution]);

  // PiP表示用のテストケースインデックス
  const pipTestCaseIndex = useMemo(() => {
    if (!pipTestCase) return -1;
    return sortedTestCases.findIndex((tc) => tc.id === pipTestCase.id);
  }, [pipTestCase, sortedTestCases]);

  // PiP内でのテストケースナビゲーション（URLも更新）
  const handlePipNavigateToTestCase = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = pipTestCaseIndex;
    if (currentIndex < 0) return;
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < sortedTestCases.length) {
      handleTestCaseSelect(sortedTestCases[newIndex].id);
    }
  }, [pipTestCaseIndex, sortedTestCases, handleTestCaseSelect]);

  // ローディング表示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  // 実行が見つからない
  if (!execution) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">実行が見つかりません</div>
      </div>
    );
  }

  // 編集可否判定（statusフィールド廃止により常に編集可能）
  const isEditable = true;
  const executionTestSuite = execution.executionTestSuite;

  // メインコンテンツの条件分岐
  // テストケース未選択 → 概要パネル
  // テストケース選択済み → 詳細パネル
  if (!selectedTestCase) {
    // テストケースがない場合はPiPボタンを表示しない
    const hasPipTarget = pipTestCase !== null;

    return (
      <>
        <ExecutionOverviewPanel
          execution={execution}
          executionTestSuite={executionTestSuite}
          suitePreconditionResults={suitePreconditionResults}
          isEditable={isEditable}
          onPreconditionStatusChange={handlePreconditionStatusChange}
          onPreconditionNoteChange={handlePreconditionNoteChange}
          updatingPreconditionStatusId={updatingPreconditionStatusId}
          updatingPreconditionNoteId={updatingPreconditionNoteId}
          isPipSupported={hasPipTarget && isPipSupported}
          isPipActive={isPipActive}
          onOpenPip={openPip}
        />

        {/* 概要画面用 Picture-in-Picture ポータル（1番目のテストケースを表示） */}
        {pipTestCase && (
          <PipPortal pipWindow={pipWindow}>
            <PipExecutionPanel
              pipWindow={pipWindow}
              testCaseId={pipTestCase.id}
              testCaseTitle={pipTestCase.title}
              suitePreconditions={executionTestSuite?.preconditions ?? []}
              casePreconditions={pipTestCase.preconditions}
              steps={pipTestCase.steps}
              expectedResults={pipTestCase.expectedResults}
              preconditionResults={[...suitePreconditionResults, ...pipTestCaseResults.preconditionResults]}
              stepResults={pipTestCaseResults.stepResults}
              expectedResultResults={pipTestCaseResults.expectedResults}
              isEditable={isEditable}
              updatingPreconditionStatusId={updatingPreconditionStatusId}
              updatingPreconditionNoteId={updatingPreconditionNoteId}
              updatingStepStatusId={updatingStepStatusId}
              updatingStepNoteId={updatingStepNoteId}
              updatingExpectedStatusId={updatingExpectedStatusId}
              updatingExpectedNoteId={updatingExpectedNoteId}
              onPreconditionStatusChange={handlePreconditionStatusChange}
              onPreconditionNoteChange={handlePreconditionNoteChange}
              onStepStatusChange={handleStepStatusChange}
              onStepNoteChange={handleStepNoteChange}
              onExpectedStatusChange={handleExpectedStatusChange}
              onExpectedNoteChange={handleExpectedNoteChange}
              isFirstTestCase={pipTestCaseIndex === 0}
              currentTestCaseIndex={pipTestCaseIndex}
              totalTestCases={sortedTestCases.length}
              onNavigateToTestCase={handlePipNavigateToTestCase}
              onClose={closePip}
            />
          </PipPortal>
        )}
      </>
    );
  }

  return (
    <>
      <ExecutionTestCaseDetailPanel
        testCase={selectedTestCase}
        preconditionResults={selectedTestCaseResults.preconditionResults}
        stepResults={selectedTestCaseResults.stepResults}
        expectedResults={selectedTestCaseResults.expectedResults}
        isEditable={isEditable}
        updatingPreconditionStatusId={updatingPreconditionStatusId}
        updatingPreconditionNoteId={updatingPreconditionNoteId}
        updatingStepStatusId={updatingStepStatusId}
        updatingStepNoteId={updatingStepNoteId}
        updatingExpectedStatusId={updatingExpectedStatusId}
        updatingExpectedNoteId={updatingExpectedNoteId}
        onPreconditionStatusChange={handlePreconditionStatusChange}
        onPreconditionNoteChange={handlePreconditionNoteChange}
        onStepStatusChange={handleStepStatusChange}
        onStepNoteChange={handleStepNoteChange}
        onExpectedStatusChange={handleExpectedStatusChange}
        onExpectedNoteChange={handleExpectedNoteChange}
        uploadingEvidenceResultId={uploadingEvidenceResultId}
        deletingEvidenceId={deletingEvidenceId}
        downloadingEvidenceId={downloadingEvidenceId}
        onEvidenceUpload={handleEvidenceUpload}
        onEvidenceDelete={handleEvidenceDelete}
        onEvidenceDownload={handleEvidenceDownload}
        isPipSupported={isPipSupported}
        isPipActive={isPipActive}
        onOpenPip={openPip}
      />

      {/* Picture-in-Picture ポータル */}
      <PipPortal pipWindow={pipWindow}>
        <PipExecutionPanel
          pipWindow={pipWindow}
          testCaseId={selectedTestCase.id}
          testCaseTitle={selectedTestCase.title}
          suitePreconditions={executionTestSuite?.preconditions ?? []}
          casePreconditions={selectedTestCase.preconditions}
          steps={selectedTestCase.steps}
          expectedResults={selectedTestCase.expectedResults}
          preconditionResults={[...suitePreconditionResults, ...selectedTestCaseResults.preconditionResults]}
          stepResults={selectedTestCaseResults.stepResults}
          expectedResultResults={selectedTestCaseResults.expectedResults}
          isEditable={isEditable}
          updatingPreconditionStatusId={updatingPreconditionStatusId}
          updatingPreconditionNoteId={updatingPreconditionNoteId}
          updatingStepStatusId={updatingStepStatusId}
          updatingStepNoteId={updatingStepNoteId}
          updatingExpectedStatusId={updatingExpectedStatusId}
          updatingExpectedNoteId={updatingExpectedNoteId}
          onPreconditionStatusChange={handlePreconditionStatusChange}
          onPreconditionNoteChange={handlePreconditionNoteChange}
          onStepStatusChange={handleStepStatusChange}
          onStepNoteChange={handleStepNoteChange}
          onExpectedStatusChange={handleExpectedStatusChange}
          onExpectedNoteChange={handleExpectedNoteChange}
          isFirstTestCase={currentTestCaseIndex === 0}
          currentTestCaseIndex={currentTestCaseIndex}
          totalTestCases={sortedTestCases.length}
          onNavigateToTestCase={handleNavigateToTestCase}
          onClose={closePip}
        />
      </PipPortal>
    </>
  );
}
