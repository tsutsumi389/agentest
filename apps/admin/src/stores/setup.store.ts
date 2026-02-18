import { create } from 'zustand';
import { setupApi } from '../lib/api';

/**
 * セットアップ状態ストア
 * API呼び出しは初回のみ実行し、結果をキャッシュする
 */
interface SetupState {
  /** チェック完了フラグ */
  setupCheckDone: boolean;
  /** セットアップが必要かどうか */
  isSetupRequired: boolean;
  /** APIエラーが発生したかどうか */
  hasError: boolean;
  /** セットアップ状態をチェック（初回のみAPI呼び出し） */
  checkSetupStatus: () => Promise<void>;
  /** セットアップ完了後に状態を更新 */
  markSetupComplete: () => void;
}

export const useSetupStore = create<SetupState>((set, get) => ({
  setupCheckDone: false,
  isSetupRequired: false,
  hasError: false,

  checkSetupStatus: async () => {
    // 既にチェック済みなら再実行しない
    if (get().setupCheckDone) return;

    try {
      const { isSetupRequired } = await setupApi.getStatus();
      set({ isSetupRequired, setupCheckDone: true, hasError: false });
    } catch {
      // APIエラーの場合はエラー状態を記録（セットアップ不要として続行しない）
      set({ setupCheckDone: true, hasError: true, isSetupRequired: false });
    }
  },

  markSetupComplete: () => {
    set({ isSetupRequired: false });
  },
}));
