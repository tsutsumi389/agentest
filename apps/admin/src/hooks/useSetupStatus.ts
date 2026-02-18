import { useState, useEffect } from 'react';
import { setupApi } from '../lib/api';

/**
 * セットアップ状態を確認するカスタムフック
 * AdminUserが0件（セットアップ未完了）の場合に isSetupRequired: true を返す
 */
export function useSetupStatus() {
  const [setupCheckDone, setSetupCheckDone] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const { isSetupRequired } = await setupApi.getStatus();
        setIsSetupRequired(isSetupRequired);
      } catch {
        // APIエラーの場合はセットアップ不要として続行（認証チェックで保護される）
      } finally {
        setSetupCheckDone(true);
      }
    };

    checkSetup();
  }, []);

  return { setupCheckDone, isSetupRequired };
}
