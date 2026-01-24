import { Activity, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { AdminDashboardSystemHealth, SystemHealthStatus } from '@agentest/shared';

interface SystemHealthCardProps {
  health: AdminDashboardSystemHealth;
}

/**
 * ヘルスステータスのインジケーター
 */
function StatusIndicator({ status, label }: { status: SystemHealthStatus; label: string }) {
  const statusConfig: Record<SystemHealthStatus['status'], {
    icon: typeof CheckCircle2;
    color: string;
    bgColor: string;
    text: string;
  }> = {
    healthy: {
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      text: '正常',
    },
    unhealthy: {
      icon: XCircle,
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      text: '異常',
    },
    not_configured: {
      icon: AlertCircle,
      color: 'text-foreground-muted',
      bgColor: 'bg-background-tertiary',
      text: '未設定',
    },
  };

  const config = statusConfig[status.status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${config.bgColor}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status.latency !== undefined && status.status === 'healthy' && (
          <span className="text-xs text-foreground-muted">{status.latency}ms</span>
        )}
        <span className={`text-sm ${config.color}`}>{config.text}</span>
      </div>
    </div>
  );
}

/**
 * システムヘルスカード
 */
export function SystemHealthCard({ health }: SystemHealthCardProps) {
  // 全体のステータスを判定
  const allHealthy =
    health.api.status === 'healthy' &&
    health.database.status === 'healthy' &&
    (health.redis.status === 'healthy' || health.redis.status === 'not_configured') &&
    (health.minio.status === 'healthy' || health.minio.status === 'not_configured');

  const overallStatus = allHealthy ? 'healthy' : 'unhealthy';
  const overallConfig = {
    healthy: { color: 'text-success', text: '全サービス正常' },
    unhealthy: { color: 'text-danger', text: '一部サービスに問題あり' },
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">システムヘルス</h2>
          </div>
          <span className={`text-sm font-medium ${overallConfig[overallStatus].color}`}>
            {overallConfig[overallStatus].text}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <StatusIndicator status={health.api} label="API" />
        <StatusIndicator status={health.database} label="Database" />
        <StatusIndicator status={health.redis} label="Redis" />
        <StatusIndicator status={health.minio} label="MinIO" />
      </div>
    </div>
  );
}
