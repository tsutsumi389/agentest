import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '../../stores/toast';

/**
 * 通知設定
 */
export function NotificationSettings() {
  const [preferences, setPreferences] = useState<
    Array<{
      type: string;
      label: string;
      description: string;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  // 通知タイプのラベルと説明
  const notificationTypeInfo: Record<string, { label: string; description: string }> = {
    ORG_INVITATION: { label: '組織への招待', description: '組織に招待されたとき' },
    INVITATION_ACCEPTED: { label: '招待の承諾', description: 'あなたの招待が承諾されたとき' },
    PROJECT_ADDED: { label: 'プロジェクト追加', description: 'プロジェクトに追加されたとき' },
    REVIEW_COMMENT: { label: 'レビューコメント', description: 'レビューにコメントがついたとき' },
    TEST_COMPLETED: { label: 'テスト完了', description: 'テスト実行が完了したとき' },
    TEST_FAILED: { label: 'テスト失敗', description: 'テスト実行が失敗したとき' },
  };

  // 初期データ取得
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/notifications/preferences', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const prefs = data.preferences.map(
            (p: { type: string; emailEnabled: boolean; inAppEnabled: boolean }) => ({
              type: p.type,
              ...(notificationTypeInfo[p.type] || { label: p.type, description: '' }),
              emailEnabled: p.emailEnabled,
              inAppEnabled: p.inAppEnabled,
            })
          );
          setPreferences(prefs);
        }
      } catch (error) {
        console.error('通知設定の取得に失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  // 設定を更新
  const updatePreference = async (
    type: string,
    field: 'emailEnabled' | 'inAppEnabled',
    value: boolean
  ) => {
    setIsSaving(type);
    try {
      const response = await fetch(`/api/notifications/preferences/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        setPreferences((prev) => prev.map((p) => (p.type === type ? { ...p, [field]: value } : p)));
        toast.success('通知設定を更新しました');
      } else {
        toast.error('通知設定の更新に失敗しました');
      }
    } catch {
      toast.error('通知設定の更新に失敗しました');
    } finally {
      setIsSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">通知設定</h2>
      <p className="text-foreground-muted mb-6">通知の受け取り方法をカスタマイズできます。</p>

      <div className="space-y-4">
        {/* テーブルヘッダー */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-4 text-sm font-medium text-foreground-muted">
          <div className="col-span-6">通知タイプ</div>
          <div className="col-span-3 text-center">アプリ内通知</div>
          <div className="col-span-3 text-center">メール通知</div>
        </div>

        {/* 設定リスト */}
        <div className="divide-y divide-border border border-border rounded-lg">
          {preferences.map((pref) => (
            <div key={pref.type} className="p-4">
              <div className="sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center">
                {/* ラベルと説明 */}
                <div className="col-span-6 mb-3 sm:mb-0">
                  <p className="font-medium text-foreground">{pref.label}</p>
                  <p className="text-sm text-foreground-muted">{pref.description}</p>
                </div>

                {/* トグルスイッチ */}
                <div className="col-span-3 flex items-center justify-between sm:justify-center gap-2">
                  <span className="sm:hidden text-sm text-foreground-muted">アプリ内</span>
                  <button
                    onClick={() => updatePreference(pref.type, 'inAppEnabled', !pref.inAppEnabled)}
                    disabled={isSaving === pref.type}
                    className={`
                      relative w-10 h-5 rounded-full transition-colors
                      ${pref.inAppEnabled ? 'bg-accent' : 'bg-background-tertiary'}
                      ${isSaving === pref.type ? 'opacity-50' : ''}
                    `}
                    aria-label={`アプリ内通知${pref.inAppEnabled ? 'を無効にする' : 'を有効にする'}`}
                  >
                    <span
                      className={`
                        absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                        ${pref.inAppEnabled ? 'left-5' : 'left-0.5'}
                      `}
                    />
                  </button>
                </div>

                <div className="col-span-3 flex items-center justify-between sm:justify-center gap-2 mt-2 sm:mt-0">
                  <span className="sm:hidden text-sm text-foreground-muted">メール</span>
                  <button
                    onClick={() => updatePreference(pref.type, 'emailEnabled', !pref.emailEnabled)}
                    disabled={isSaving === pref.type}
                    className={`
                      relative w-10 h-5 rounded-full transition-colors
                      ${pref.emailEnabled ? 'bg-accent' : 'bg-background-tertiary'}
                      ${isSaving === pref.type ? 'opacity-50' : ''}
                    `}
                    aria-label={`メール通知${pref.emailEnabled ? 'を無効にする' : 'を有効にする'}`}
                  >
                    <span
                      className={`
                        absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                        ${pref.emailEnabled ? 'left-5' : 'left-0.5'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
