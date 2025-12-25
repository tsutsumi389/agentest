import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Dashboard } from './pages/Dashboard';

/**
 * 管理画面アプリケーション
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ダッシュボード */}
        <Route path="/" element={<Dashboard />} />

        {/* その他のルートはダッシュボードにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
