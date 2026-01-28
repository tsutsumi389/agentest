/**
 * 組織請求履歴一覧
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '../../../stores/toast';
import { ApiError, orgBillingApi, type OrgInvoice, type OrgInvoiceStatus } from '../../../lib/api';
import { formatPrice, formatInvoiceDate } from '../../../lib/billing';

interface OrgInvoiceListProps {
  organizationId: string;
}

const ITEMS_PER_PAGE = 10;

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
      const errorMessage = err instanceof ApiError
        ? err.message
        : '請求履歴の取得に失敗しました';
      setError(errorMessage);
      toast.error(errorMessage);
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
          <button
            className="btn btn-primary btn-sm mt-4"
            onClick={fetchInvoices}
          >
            再読み込み
          </button>
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
          <FileText className="w-12 h-12 text-foreground-subtle mx-auto mb-3" aria-hidden="true" />
          <p className="text-foreground-muted">請求履歴がありません</p>
        </div>
      ) : (
        <>
          {/* 請求書テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted" scope="col">
                    請求番号
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted" scope="col">
                    請求日
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-muted" scope="col">
                    期間
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-foreground-muted" scope="col">
                    金額
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted" scope="col">
                    ステータス
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-foreground-muted" scope="col">
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
                        {formatInvoiceDate(invoice.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground-muted">
                        {formatInvoiceDate(invoice.periodStart)} 〜 {formatInvoiceDate(invoice.periodEnd)}
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
                            aria-label={`請求書 ${invoice.invoiceNumber} のPDFをダウンロード`}
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-foreground-subtle" aria-label="PDF未対応">-</span>
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
            <nav
              className="flex items-center justify-between mt-4 pt-4 border-t border-border"
              aria-label="請求履歴のページネーション"
            >
              <p className="text-sm text-foreground-muted">
                {total}件中 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, total)}件を表示
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="前のページ"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  前へ
                </button>
                <span className="text-sm text-foreground-muted" aria-current="page">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="次のページ"
                >
                  次へ
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
