import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth';

/**
 * OAuth認証コールバックページ
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { initialize } = useAuthStore();

  useEffect(() => {
    // 認証状態を初期化してダッシュボードにリダイレクト
    const handleCallback = async () => {
      await initialize();
      navigate('/dashboard', { replace: true });
    };

    handleCallback();
  }, [initialize, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-foreground-muted">認証中...</p>
      </div>
    </div>
  );
}
