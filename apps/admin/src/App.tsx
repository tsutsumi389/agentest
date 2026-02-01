import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { MetricsPage } from './pages/MetricsPage';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Organizations } from './pages/Organizations';
import { OrganizationDetail } from './pages/OrganizationDetail';
import { AuditLogs } from './pages/AuditLogs';
import { LoginPage } from './pages/auth/Login';
import { TwoFactorAuthPage } from './pages/auth/TwoFactorAuth';
import { AuthGuard, AdminLayout } from './components/layout';
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

        {/* 認証必須（AdminLayout内にネスト） */}
        <Route
          element={
            <AuthGuard>
              <AdminLayout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>

        {/* その他のルートはダッシュボードにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
