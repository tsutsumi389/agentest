import { env } from '../config/env.js';

/**
 * 内部APIクライアント
 * 共有シークレットを使用してAPIサーバーと通信
 */
export class InternalApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Docker内部ネットワーク経由（デフォルト値はZodスキーマで設定）
    this.baseUrl = env.API_INTERNAL_URL;
    this.apiKey = env.INTERNAL_API_SECRET;
  }

  /**
   * GETリクエストを送信
   */
  async get<T>(path: string, params?: Record<string, string | number | string[] | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) {
          if (Array.isArray(v)) {
            // 配列の場合は複数のパラメータとして追加（例: ?status=DRAFT&status=ACTIVE）
            v.forEach((item) => url.searchParams.append(k, String(item)));
          } else {
            url.searchParams.set(k, String(v));
          }
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Internal-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`Internal API error: ${res.status} - ${error.message || 'Unknown error'}`);
    }

    return res.json() as T;
  }

  /**
   * POSTリクエストを送信
   */
  async post<T>(path: string, body: Record<string, unknown>, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) {
          url.searchParams.set(k, v);
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'X-Internal-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`Internal API error: ${res.status} - ${error.message || 'Unknown error'}`);
    }

    return res.json() as T;
  }

  /**
   * PATCHリクエストを送信
   */
  async patch<T>(path: string, body: Record<string, unknown>, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) {
          url.searchParams.set(k, v);
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        'X-Internal-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`Internal API error: ${res.status} - ${error.message || 'Unknown error'}`);
    }

    return res.json() as T;
  }
}

export const apiClient = new InternalApiClient();
