import { useState } from 'react';
import { adminProfileApi, ApiError } from '../lib/api';
import { useAdminAuthStore } from '../stores/admin-auth.store';

/**
 * プロフィール名前更新フック
 */
export function useUpdateProfile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const updateAdmin = useAdminAuthStore((state) => state.updateAdmin);

  const mutate = async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { admin } = await adminProfileApi.updateProfile({ name });
      updateAdmin(admin);
      return admin;
    } catch (e) {
      const apiError =
        e instanceof ApiError ? e : new ApiError(500, 'UNKNOWN_ERROR', '更新に失敗しました');
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
}

/**
 * パスワード変更フック
 */
export function useChangePassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = async (currentPassword: string, newPassword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await adminProfileApi.changePassword({ currentPassword, newPassword });
    } catch (e) {
      const apiError =
        e instanceof ApiError
          ? e
          : new ApiError(500, 'UNKNOWN_ERROR', 'パスワード変更に失敗しました');
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
}

/**
 * 2FAセットアップフック
 */
export function useSetup2FA() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      return await adminProfileApi.setup2FA();
    } catch (e) {
      const apiError =
        e instanceof ApiError
          ? e
          : new ApiError(500, 'UNKNOWN_ERROR', '2FAセットアップに失敗しました');
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
}

/**
 * 2FA有効化フック
 */
export function useEnable2FA() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const updateAdmin = useAdminAuthStore((state) => state.updateAdmin);

  const mutate = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await adminProfileApi.enable2FA(code);
      // ストアの最新状態を取得して2FA状態を更新
      const currentAdmin = useAdminAuthStore.getState().admin;
      if (currentAdmin) {
        updateAdmin({ ...currentAdmin, totpEnabled: true });
      }
    } catch (e) {
      const apiError =
        e instanceof ApiError ? e : new ApiError(500, 'UNKNOWN_ERROR', '2FA有効化に失敗しました');
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
}

/**
 * 2FA無効化フック
 */
export function useDisable2FA() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const updateAdmin = useAdminAuthStore((state) => state.updateAdmin);

  const mutate = async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await adminProfileApi.disable2FA(password);
      // ストアの最新状態を取得して2FA状態を更新
      const currentAdmin = useAdminAuthStore.getState().admin;
      if (currentAdmin) {
        updateAdmin({ ...currentAdmin, totpEnabled: false });
      }
    } catch (e) {
      const apiError =
        e instanceof ApiError ? e : new ApiError(500, 'UNKNOWN_ERROR', '2FA無効化に失敗しました');
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error };
}
