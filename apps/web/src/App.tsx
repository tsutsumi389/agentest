import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from './stores/auth';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { ProjectsPage } from './pages/Projects';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { TestSuiteDetailPage } from './pages/TestSuiteDetail';
import { ExecutionPage } from './pages/Execution';
import { SettingsPage } from './pages/Settings';
import { AuthCallbackPage } from './pages/AuthCallback';
import { OrganizationsPage } from './pages/Organizations';
import { OrganizationSettingsPage } from './pages/OrganizationSettings';

/**
 * 認証が必要なルートをラップするコンポーネント
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * アプリケーションルート
 */
export function App() {
  const { initialize } = useAuthStore();

  // 初回マウント時に認証状態を確認
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* パブリックルート */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* 保護されたルート */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <OrganizationProvider>
                  <Layout />
                </OrganizationProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="test-suites/:testSuiteId" element={<TestSuiteDetailPage />} />
            <Route path="executions/:executionId" element={<ExecutionPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:organizationId/settings" element={<OrganizationSettingsPage />} />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
                  <p className="text-foreground-muted">ページが見つかりません</p>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
