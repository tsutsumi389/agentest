import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Channels, type DashboardUpdatedEvent } from '@agentest/ws-types';
import { projectsApi, type ProjectDashboardStats, type Label, type ProjectEnvironment, labelsApi } from '../lib/api';
import { wsClient } from '../lib/ws';

/**
 * デバウンス遅延（ミリ秒）
 */
const DEBOUNCE_DELAY_MS = 500;

/**
 * useProjectDashboardオプション
 */
interface UseProjectDashboardOptions {
  projectId: string;
  environmentId?: string;
  labelIds?: string[];
}

/**
 * useProjectDashboardの戻り値
 */
interface UseProjectDashboardResult {
  stats: ProjectDashboardStats | null;
  environments: ProjectEnvironment[];
  labels: Label[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * プロジェクトダッシュボードフック
 * WebSocketでリアルタイム更新を受け取り、デバウンス付きでリフェッチする
 */
export function useProjectDashboard(options: UseProjectDashboardOptions): UseProjectDashboardResult {
  const { projectId, environmentId, labelIds = [] } = options;

  const [stats, setStats] = useState<ProjectDashboardStats | null>(null);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // labelIdsの依存を安定化（配列の参照が変わらないようにする）
  const labelIdsKey = labelIds.join(',');
  const stableLabelIds = useMemo(() => labelIds, [labelIdsKey]);

  /**
   * ダッシュボードデータを取得
   */
  const fetchDashboard = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setIsLoading(true);
      }
      setError(null);

      const params = environmentId || stableLabelIds.length > 0
        ? { environmentId, labelIds: stableLabelIds }
        : undefined;

      const response = await projectsApi.getDashboard(projectId, params);
      setStats(response.dashboard);
    } catch {
      setError('ダッシュボードの取得に失敗しました');
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, [projectId, environmentId, stableLabelIds]);

  /**
   * 環境とラベル一覧を取得
   */
  const fetchFilterData = useCallback(async () => {
    try {
      const [envResponse, labelResponse] = await Promise.all([
        projectsApi.getEnvironments(projectId),
        labelsApi.getByProject(projectId),
      ]);
      setEnvironments(envResponse.environments);
      setLabels(labelResponse.labels);
    } catch {
      // フィルターデータ取得失敗は無視（ダッシュボードは表示する）
    }
  }, [projectId]);

  /**
   * デバウンス付きリフェッチ
   */
  const debouncedRefetch = useCallback(() => {
    // 既存のタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 新しいタイマーを設定
    debounceTimerRef.current = setTimeout(() => {
      fetchDashboard(true);
    }, DEBOUNCE_DELAY_MS);
  }, [fetchDashboard]);

  /**
   * WebSocketイベント購読
   */
  useEffect(() => {
    const channel = Channels.project(projectId);

    // チャンネルを購読
    wsClient.subscribe([channel]);

    // dashboard:updatedイベントを購読
    const unsubscribe = wsClient.on<DashboardUpdatedEvent>('dashboard:updated', (event) => {
      if (event.projectId === projectId) {
        debouncedRefetch();
      }
    });

    return () => {
      unsubscribe();
      wsClient.unsubscribe([channel]);

      // タイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectId, debouncedRefetch]);

  /**
   * フィルターデータの初期ロード
   */
  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  /**
   * ダッシュボードの初期ロードとフィルター変更時のリフェッチ
   */
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    stats,
    environments,
    labels,
    isLoading,
    error,
    refetch: fetchDashboard,
  };
}
