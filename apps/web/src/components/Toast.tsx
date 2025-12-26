import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type Toast as ToastType } from '../stores/toast';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: 'bg-success/10 border-success text-success',
  error: 'bg-danger/10 border-danger text-danger',
  info: 'bg-accent/10 border-accent text-accent',
  warning: 'bg-warning/10 border-warning text-warning',
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
        flex items-center gap-3 px-4 py-3 rounded border
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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
