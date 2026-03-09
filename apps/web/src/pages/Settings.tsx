import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router';
import { User, Bell, Shield, Key, Bot } from 'lucide-react';
import { toast } from '../stores/toast';
import { ProfileSettings } from './settings/ProfileSettings';
import { NotificationSettings } from './settings/NotificationSettings';
import { SecuritySettings } from './settings/SecuritySettings';
import { ApiTokenSettings } from './settings/ApiTokenSettings';
import { McpSessionSettings } from './settings/McpSessionSettings';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'api-tokens' | 'mcp-sessions';

/**
 * 設定ページ
 */
export function SettingsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTab | null;

  // パス /settings/notifications からタブを判定
  const getInitialTab = (): SettingsTab => {
    // パスが /settings/notifications の場合は notifications タブ
    if (location.pathname === '/settings/notifications') {
      return 'notifications';
    }
    // クエリパラメータからタブを取得
    if (tabParam && ['profile', 'notifications', 'security', 'api-tokens', 'mcp-sessions'].includes(tabParam)) {
      return tabParam;
    }
    return 'profile';
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(getInitialTab());

  // OAuth連携結果のハンドリング
  useEffect(() => {
    const link = searchParams.get('link');
    const message = searchParams.get('message');

    if (link === 'success') {
      toast.success('OAuth連携を追加しました');
      // パラメータをクリア
      searchParams.delete('link');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    } else if (link === 'error') {
      toast.error(message || 'OAuth連携に失敗しました');
      // パラメータをクリア
      searchParams.delete('link');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // タブを変更するとURLパラメータも更新
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  const tabs = [
    { id: 'profile' as const, label: 'プロフィール', icon: User },
    { id: 'notifications' as const, label: '通知', icon: Bell },
    { id: 'security' as const, label: 'セキュリティ', icon: Shield },
    { id: 'api-tokens' as const, label: 'APIトークン', icon: Key },
    { id: 'mcp-sessions' as const, label: 'MCPセッション', icon: Bot },
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">設定</h1>
        <p className="text-foreground-muted mt-1">
          アカウントとアプリケーションの設定
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* タブナビゲーション */}
        <nav className="lg:w-48 flex-shrink-0">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                    ${activeTab === tab.id
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* コンテンツ */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'api-tokens' && <ApiTokenSettings />}
          {activeTab === 'mcp-sessions' && <McpSessionSettings />}
        </div>
      </div>
    </div>
  );
}
