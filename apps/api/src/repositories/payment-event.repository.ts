/**
 * 決済イベントリポジトリ
 *
 * Webhook冪等性確保・監査ログ用のPaymentEventを管理
 */

import {
  prisma,
  type PaymentEvent,
  type PaymentEventStatus,
  type Prisma,
} from '@agentest/db';

/**
 * 決済イベント作成パラメータ
 */
export interface CreatePaymentEventParams {
  externalId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}

/**
 * 決済イベント更新パラメータ
 */
export interface UpdatePaymentEventParams {
  status?: PaymentEventStatus;
  processedAt?: Date;
  errorMessage?: string | null;
  retryCount?: number;
}

/**
 * 決済イベントリポジトリ
 */
export class PaymentEventRepository {
  /**
   * IDで決済イベントを取得
   */
  async findById(id: string): Promise<PaymentEvent | null> {
    return prisma.paymentEvent.findUnique({
      where: { id },
    });
  }

  /**
   * 外部ID（StripeイベントID）で決済イベントを取得
   * 冪等性チェックに使用
   */
  async findByExternalId(externalId: string): Promise<PaymentEvent | null> {
    return prisma.paymentEvent.findUnique({
      where: { externalId },
    });
  }

  /**
   * 決済イベントを作成
   */
  async create(params: CreatePaymentEventParams): Promise<PaymentEvent> {
    return prisma.paymentEvent.create({
      data: {
        externalId: params.externalId,
        eventType: params.eventType,
        payload: params.payload,
        status: 'PENDING',
      },
    });
  }

  /**
   * 決済イベントを更新
   */
  async update(
    id: string,
    params: UpdatePaymentEventParams
  ): Promise<PaymentEvent> {
    const data: Prisma.PaymentEventUpdateInput = {};

    if (params.status !== undefined) data.status = params.status;
    if (params.processedAt !== undefined) data.processedAt = params.processedAt;
    if (params.errorMessage !== undefined)
      data.errorMessage = params.errorMessage;
    if (params.retryCount !== undefined) data.retryCount = params.retryCount;

    return prisma.paymentEvent.update({
      where: { id },
      data,
    });
  }

  /**
   * 決済イベントを処理済みとしてマーク
   */
  async markAsProcessed(id: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  /**
   * 決済イベントを失敗としてマーク
   */
  async markAsFailed(id: string, errorMessage: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage,
        retryCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * リトライ対象の失敗イベントを取得
   * maxRetryCount未満のFAILEDイベントを対象
   */
  async findFailedForRetry(
    maxRetryCount: number,
    limit: number = 100
  ): Promise<PaymentEvent[]> {
    return prisma.paymentEvent.findMany({
      where: {
        status: 'FAILED',
        retryCount: {
          lt: maxRetryCount,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });
  }

  /**
   * リトライのためにPENDINGに戻す
   */
  async resetForRetry(id: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    });
  }

  /**
   * 古い処理済みイベントを削除
   * クリーンアップバッチで使用
   */
  async deleteProcessedBefore(beforeDate: Date): Promise<number> {
    const result = await prisma.paymentEvent.deleteMany({
      where: {
        status: 'PROCESSED',
        createdAt: {
          lt: beforeDate,
        },
      },
    });
    return result.count;
  }

  /**
   * ステータス別のイベント数を取得
   */
  async countByStatus(): Promise<Record<PaymentEventStatus, number>> {
    const results = await prisma.paymentEvent.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const counts: Record<PaymentEventStatus, number> = {
      PENDING: 0,
      PROCESSED: 0,
      FAILED: 0,
    };

    for (const result of results) {
      counts[result.status] = result._count.status;
    }

    return counts;
  }

  /**
   * イベントタイプでイベントを検索
   */
  async findByEventType(
    eventType: string,
    options?: {
      status?: PaymentEventStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaymentEvent[]> {
    return prisma.paymentEvent.findMany({
      where: {
        eventType,
        ...(options?.status && { status: options.status }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });
  }
}
