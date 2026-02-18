import { useEffect } from 'react';
import { useSetupStore } from '../stores/setup.store';

/**
 * セットアップ状態を確認するカスタムフック
 * Zustandストアを使用し、API呼び出しは初回のみ実行される
 */
export function useSetupStatus() {
  const setupCheckDone = useSetupStore((state) => state.setupCheckDone);
  const isSetupRequired = useSetupStore((state) => state.isSetupRequired);
  const hasError = useSetupStore((state) => state.hasError);
  const checkSetupStatus = useSetupStore((state) => state.checkSetupStatus);

  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  return { setupCheckDone, isSetupRequired, hasError };
}
