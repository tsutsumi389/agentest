import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/auth/Login';
import { TwoFactorAuthPage } from './pages/auth/TwoFactorAuth';
import { AuthGuard } from './components/layout/AuthGuard';
import { useAdminAuthStore } from './stores/admin-auth.store';

/**
 * 管理画面アプリケーション
 */
export function App() {
  const initialize = useAdminAuthStore((state) => state.initialize);

  // アプリ起動時に認証状態を初期化
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 認証不要 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/2fa" element={<TwoFactorAuthPage />} />

        {/* 認証必須 */}
        <Route
          path="/"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />

        {/* その他のルートはダッシュボードにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
