import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type Toast as ToastType } from '../stores/toast';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

// ガイドライン準拠: subtle背景 + 左ボーダー強調
const colorMap = {
  success: 'bg-success-subtle border-l-4 border-l-success border-y border-r border-border',
  error: 'bg-danger-subtle border-l-4 border-l-danger border-y border-r border-border',
  info: 'bg-accent-subtle border-l-4 border-l-accent border-y border-r border-border',
  warning: 'bg-warning-subtle border-l-4 border-l-warning border-y border-r border-border',
};

/**
 * 個別のトースト
 */
function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToastStore();
  const Icon = iconMap[toast.type];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg
        shadow-lg backdrop-blur-sm animate-slide-in
        ${colorMap[toast.type]}
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1 text-foreground">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-1 hover:bg-background-tertiary rounded transition-colors"
        aria-label="閉じる"
      >
        <X className="w-4 h-4 text-foreground-muted" />
      </button>
    </div>
  );
}

/**
 * トーストコンテナ
 */
export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 max-w-sm"
      role="region"
      aria-label="通知"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
