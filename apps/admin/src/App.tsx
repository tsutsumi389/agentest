import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { Organizations } from './pages/Organizations';
import { OrganizationDetail } from './pages/OrganizationDetail';
import { AuditLogs } from './pages/AuditLogs';
import { SystemAdmins } from './pages/SystemAdmins';
import { SystemAdminDetail } from './pages/SystemAdminDetail';
import { LoginPage } from './pages/auth/Login';
import { TwoFactorAuthPage } from './pages/auth/TwoFactorAuth';
import { AcceptInvitationPage } from './pages/auth/AcceptInvitation';
import { SetupPage } from './pages/auth/Setup';
import { ErrorBoundary } from './components/ErrorBoundary';
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
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* 認証不要 */}
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/2fa" element={<TwoFactorAuthPage />} />
          <Route path="/invitation/:token" element={<AcceptInvitationPage />} />

          {/* 認証必須（AdminLayout内にネスト） */}
          <Route
            element={
              <AuthGuard>
                <AdminLayout />
              </AuthGuard>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/organizations" element={<Organizations />} />
            <Route path="/organizations/:id" element={<OrganizationDetail />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/system-admins" element={<SystemAdmins />} />
            <Route path="/system-admins/:id" element={<SystemAdminDetail />} />
          </Route>

          {/* その他のルートはダッシュボードにリダイレクト */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
