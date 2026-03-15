import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Play } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { projectsApi, testSuitesApi, ApiError, type Execution } from '../../lib/api';
import { toast } from '../../stores/toast';

interface StartExecutionModalProps {
  isOpen: boolean;
  testSuiteId: string;
  projectId: string;
  suiteName: string;
  testCaseCount: number;
  preconditionCount: number;
  onClose: () => void;
  onStarted: (execution: Execution) => void;
}

/**
 * テスト実行開始モーダル
 * 環境を選択して実行を開始する
 */
export function StartExecutionModal({
  isOpen,
  testSuiteId,
  projectId,
  suiteName,
  testCaseCount,
  preconditionCount,
  onClose,
  onStarted,
}: StartExecutionModalProps) {
  // 選択中の環境ID（nullは「環境を選択しない」）
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 環境一覧を取得
  const { data: environmentsData, isLoading: isLoadingEnvironments } = useQuery({
    queryKey: ['project-environments', projectId],
    queryFn: () => projectsApi.getEnvironments(projectId),
    enabled: isOpen && !!projectId,
  });

  const environments = environmentsData?.environments || [];

  // デフォルト環境を初期選択
  useEffect(() => {
    if (isOpen && !isInitialized && environments.length > 0) {
      const defaultEnv = environments.find((env) => env.isDefault);
      if (defaultEnv) {
        setSelectedEnvironmentId(defaultEnv.id);
      }
      setIsInitialized(true);
    }
  }, [isOpen, environments, isInitialized]);

  // モーダルが外部から閉じられた場合の状態リセット
  useEffect(() => {
    if (!isOpen) {
      setSelectedEnvironmentId(null);
      setIsInitialized(false);
    }
  }, [isOpen]);

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setSelectedEnvironmentId(null);
    setIsInitialized(false);
    onClose();
  }, [onClose]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // 実行開始ミューテーション
  const startMutation = useMutation({
    mutationFn: () =>
      testSuitesApi.startExecution(testSuiteId, {
        environmentId: selectedEnvironmentId || undefined,
      }),
    onSuccess: (data) => {
      toast.success('テスト実行を開始しました');
      onStarted(data.execution);
      handleClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テスト実行の開始に失敗しました');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startMutation.mutate();
  };

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !startMutation.isPending) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">テスト実行を開始</h2>
          <button
            onClick={handleClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
            disabled={startMutation.isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* テストスイート名 */}
          <div>
            <span className="text-sm text-foreground-muted">テストスイート</span>
            <p className="font-medium text-foreground">{suiteName}</p>
          </div>

          {/* 環境選択 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">環境を選択</label>
            {isLoadingEnvironments ? (
              <div className="flex items-center gap-2 text-foreground-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">読み込み中...</span>
              </div>
            ) : (
              <div className="space-y-2" role="radiogroup" aria-label="環境選択">
                {environments.map((env) => (
                  <label
                    key={env.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                      ${
                        selectedEnvironmentId === env.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-foreground-muted'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="environment"
                      value={env.id}
                      checked={selectedEnvironmentId === env.id}
                      onChange={() => setSelectedEnvironmentId(env.id)}
                      className="text-accent focus:ring-accent"
                      disabled={startMutation.isPending}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{env.name}</span>
                        {env.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                            デフォルト
                          </span>
                        )}
                      </div>
                      {env.description && (
                        <p className="text-xs text-foreground-muted truncate mt-0.5">
                          {env.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}

                {/* 環境を選択しないオプション */}
                <label
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${
                      selectedEnvironmentId === null
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-foreground-muted'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="environment"
                    value=""
                    checked={selectedEnvironmentId === null}
                    onChange={() => setSelectedEnvironmentId(null)}
                    className="text-accent focus:ring-accent"
                    disabled={startMutation.isPending}
                  />
                  <span className="text-foreground-muted">環境を選択しない</span>
                </label>
              </div>
            )}
          </div>

          {/* 実行内容サマリー */}
          <div className="flex gap-4 text-sm text-foreground-muted pt-2">
            <span>テストケース: {testCaseCount}件</span>
            <span>前提条件: {preconditionCount}件</span>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={startMutation.isPending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={startMutation.isPending || testCaseCount === 0 || isLoadingEnvironments}
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  開始中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  実行開始
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
