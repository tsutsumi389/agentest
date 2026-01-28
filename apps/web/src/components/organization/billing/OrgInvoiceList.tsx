/**
 * 組織請求履歴一覧
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApiError, orgBillingApi, type OrgInvoice, type OrgInvoiceStatus } from '../../../lib/api';

interface OrgInvoiceListProps {
  organizationId: string;
}

const ITEMS_PER_PAGE = 10;

/**
 * 日付をフォーマット
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 金額をフォーマット（日本円）
 */
function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: currency || 'JPY',
  }).format(amount);
}

/**
 * ステータスバッジを取得
 */
function getStatusBadge(status: OrgInvoiceStatus): { label: string; className: string } {
  switch (status) {
    case 'PAID':
      return { label: '支払済み', className: 'badge-success' };
    case 'PENDING':
      return { label: '未払い', className: 'badge-warning' };
    case 'FAILED':
      return { label: '失敗', className: 'badge-danger' };
    case 'REFUNDED':
      return { label: '返金済み', className: 'badge-info' };
    default:
      return { label: status, className: 'badge-secondary' };
  }
}

export function OrgInvoiceList({ organizationId }: OrgInvoiceListProps) {
  const [invoices, setInvoices] = useState<OrgInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 請求書一覧取得
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await orgBillingApi.getInvoices(organizationId, {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setInvoices(response.invoices);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('請求履歴の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, currentPage]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // ページ変更
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
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

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <p className="text-danger">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">請求履歴</h2>
          <p className="text-sm text-foreground-muted mt-1">
            過去の請求書と支払い状況を確認できます
          </p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted">請求履歴がありません</p>
        </div>
      ) : (
        <>
          {/* 請求書テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">
                    請求番号
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">
                    請求日
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted">
                    期間
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted">
                    金額
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">
                    ステータス
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const statusBadge = getStatusBadge(invoice.status);
                  return (
                    <tr
                      key={invoice.id}
                      className="border-b border-border hover:bg-background-secondary transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-foreground">
                          {invoice.invoiceNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground-muted">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground-muted">
                        {formatDate(invoice.periodStart)} 〜 {formatDate(invoice.periodEnd)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-foreground">
                          {formatPrice(invoice.amount, invoice.currency)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge ${statusBadge.className} text-xs`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {invoice.pdfUrl ? (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            title="PDFをダウンロード"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-foreground-subtle">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-sm text-foreground-muted">
                {total}件中 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, total)}件を表示
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  前へ
                </button>
                <span className="text-sm text-foreground-muted">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  次へ
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
