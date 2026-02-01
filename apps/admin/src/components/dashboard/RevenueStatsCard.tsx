import { Banknote, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { AdminDashboardRevenueStats } from '@agentest/shared/types';

interface RevenueStatsCardProps {
  stats: AdminDashboardRevenueStats;
}

/**
 * 収益統計カード
 */
export function RevenueStatsCard({ stats }: RevenueStatsCardProps) {
  // MRRをフォーマット
  const formattedMrr = stats.mrr.toLocaleString();

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
          <Banknote className="w-5 h-5 text-success" />
        </div>
      </div>

      <div className="stat-value text-success">¥{formattedMrr}</div>
      <div className="stat-label">月間経常収益 (MRR)</div>

      <div className="mt-4 space-y-3">
        {/* 請求書ステータス */}
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-foreground-muted mb-2">請求書ステータス</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <div>
                <div className="text-sm font-medium text-foreground">{stats.invoices.paid}</div>
                <div className="text-xs text-foreground-muted">支払済</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-warning" />
              <div>
                <div className="text-sm font-medium text-foreground">{stats.invoices.pending}</div>
                <div className="text-xs text-foreground-muted">未払い</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-danger" />
              <div>
                <div className="text-sm font-medium text-foreground">{stats.invoices.failed}</div>
                <div className="text-xs text-foreground-muted">失敗</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
