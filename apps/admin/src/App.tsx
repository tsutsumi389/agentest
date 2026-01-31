import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Organizations } from './pages/Organizations';
import { OrganizationDetail } from './pages/OrganizationDetail';
import { LoginPage } from './pages/auth/Login';
import { TwoFactorAuthPage } from './pages/auth/TwoFactorAuth';
import { AuthGuard } from './components/layout/AuthGuard';
import { useAdminAuthStore } from './stores/admin-auth.store';

/**
 * 管理画面アプリケーション
 */
export function App() {
  const initialize = useAdminAuthStore((state) => state.initialize);
  // 初期化済みフラグ（Strict Modeでの二重実行防止）
  const initialized = useRef(false);

  // アプリ起動時に認証状態を初期化
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initialize();
    }
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
        <Route
          path="/users"
          element={
            <AuthGuard>
              <Users />
            </AuthGuard>
          }
        />
        <Route
          path="/users/:id"
          element={
            <AuthGuard>
              <UserDetail />
            </AuthGuard>
          }
        />
        <Route
          path="/organizations"
          element={
            <AuthGuard>
              <Organizations />
            </AuthGuard>
          }
        />
        <Route
          path="/organizations/:id"
          element={
            <AuthGuard>
              <OrganizationDetail />
            </AuthGuard>
          }
        />

        {/* その他のルートはダッシュボードにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
