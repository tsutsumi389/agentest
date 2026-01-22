/**
 * 全画面ローディング表示コンポーネント
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-foreground-muted" aria-live="polite">
        読み込み中...
      </div>
    </div>
  );
}
