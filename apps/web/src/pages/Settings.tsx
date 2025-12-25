import { useState } from 'react';
import { User, Bell, Shield, Key } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import type { User as UserType } from '../lib/api';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'api-tokens';

/**
 * 設定ページ
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { user } = useAuthStore();

  const tabs = [
    { id: 'profile' as const, label: 'プロフィール', icon: User },
    { id: 'notifications' as const, label: '通知', icon: Bell },
    { id: 'security' as const, label: 'セキュリティ', icon: Shield },
    { id: 'api-tokens' as const, label: 'APIトークン', icon: Key },
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                    ${activeTab === tab.id
                      ? 'bg-accent-muted text-accent'
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
          {activeTab === 'profile' && <ProfileSettings user={user} />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'api-tokens' && <ApiTokenSettings />}
        </div>
      </div>
    </div>
  );
}

/**
 * プロフィール設定
 */
function ProfileSettings({ user }: { user: UserType | null }) {
  const [name, setName] = useState(user?.name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: プロフィール更新API呼び出し
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">プロフィール</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center">
              <span className="text-2xl font-medium text-accent">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-foreground-muted">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            表示名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input max-w-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="input max-w-md bg-background-tertiary"
          />
          <p className="text-xs text-foreground-subtle mt-1">
            メールアドレスはOAuthプロバイダーから取得されています
          </p>
        </div>

        <div className="pt-4">
          <button type="submit" className="btn btn-primary">
            保存
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * 通知設定
 */
function NotificationSettings() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">通知設定</h2>
      <p className="text-foreground-muted">
        通知設定は近日公開予定です。
      </p>
    </div>
  );
}

/**
 * セキュリティ設定
 */
function SecuritySettings() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">セキュリティ</h2>

      <div className="space-y-6">
        <div>
          <h3 className="font-medium text-foreground mb-2">接続済みアカウント</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-background-tertiary rounded">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                  <span className="text-xs">GH</span>
                </div>
                <span className="text-foreground">GitHub</span>
              </div>
              <span className="badge badge-success">接続済み</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium text-foreground mb-2">セッション</h3>
          <p className="text-sm text-foreground-muted mb-3">
            現在のセッションからログアウトします。
          </p>
          <button className="btn btn-danger">
            すべてのセッションからログアウト
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * APIトークン設定
 */
function ApiTokenSettings() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">APIトークン</h2>
      <p className="text-foreground-muted mb-4">
        MCPサーバーやCI/CDパイプラインからアクセスするためのAPIトークンを管理します。
      </p>
      <button className="btn btn-primary">
        <Key className="w-4 h-4" />
        新しいトークンを生成
      </button>
    </div>
  );
}
