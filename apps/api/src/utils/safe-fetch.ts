import { lookup as dnsLookupCallback } from 'node:dns';
import { promisify } from 'node:util';
import https from 'node:https';
import ipaddr from 'ipaddr.js';

/**
 * SSRF を防ぐためのセーフフェッチ実装。
 *
 * - https スキーム必須、fragment / userinfo 禁止
 * - DNS 解決した全 IP がプライベート / 予約レンジでないこと
 * - 検証済み IP に対して直接接続 (DNS rebinding 対策)
 * - サイズ上限 / タイムアウト / 最大3ホップのリダイレクト追跡
 *
 * 依存性注入のため `dnsLookup` と `transport` を引数で受け取る (テストで差し替え可能)。
 */

export class SafeFetchError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  /** 304 Not Modified 等で本体がない場合は null */
  body: Buffer | null;
}

export interface SafeFetchTransportArgs {
  /** 元の URL のホスト名（SNI / Host ヘッダ用） */
  hostname: string;
  /** 検証済みで接続を行う IP アドレス */
  ip: string;
  /** TCP 接続先ポート */
  port: number;
  /** path + query */
  path: string;
  /** リクエストヘッダ */
  headers: Record<string, string>;
  /** タイムアウト (ms) */
  timeoutMs: number;
  /** ボディ最大バイト数 */
  maxBytes: number;
}

export type SafeFetchTransport = (args: SafeFetchTransportArgs) => Promise<SafeFetchResponse>;

export interface SafeFetchOptions {
  timeoutMs: number;
  maxBytes: number;
  /** リクエストヘッダ (If-None-Match 等) */
  headers?: Record<string, string>;
  /** リダイレクトの最大ホップ数 (default: 3) */
  maxRedirects?: number;
  /** テスト用: DNS lookup インジェクション */
  dnsLookup?: (hostname: string) => Promise<string[]>;
  /** テスト用: トランスポートインジェクション */
  transport?: SafeFetchTransport;
}

const dnsLookupAsync = promisify(dnsLookupCallback);

/**
 * URL の形状を検証する (SSRF 入口防衛)。
 */
export function ensureUrlShape(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError('invalid URL');
  }
  if (url.protocol !== 'https:') {
    throw new SafeFetchError('only https is allowed');
  }
  if (url.hash !== '') {
    throw new SafeFetchError('URL must not contain fragment');
  }
  if (url.username !== '' || url.password !== '') {
    throw new SafeFetchError('URL must not contain userinfo');
  }
  return url;
}

/**
 * 与えられた IP アドレスがプライベート / 予約レンジに該当するかを判定する。
 *
 * 判定不能な不正文字列は安全側で true (拒否) を返す。
 */
export function isPrivateIp(ip: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return true;
  }

  const range = parsed.range();
  // ipaddr.js の range が "unicast" を返した場合のみグローバル扱い
  // それ以外 (private, loopback, linkLocal, uniqueLocal, multicast, broadcast,
  //          reserved, unspecified, carrierGradeNat, etc.) はすべて拒否
  if (range !== 'unicast') {
    return true;
  }

  // ipaddr.js は 100.64.0.0/10 (CGNAT) を unicast として扱うため明示的に拒否
  if (parsed.kind() === 'ipv4') {
    const octets = (parsed as ipaddr.IPv4).octets;
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) {
      return true;
    }
    // 169.254.169.254 等のメタデータレンジは linkLocal として既に弾かれるが念のため
    if (octets[0] === 169 && octets[1] === 254) {
      return true;
    }
  }

  return false;
}

/**
 * デフォルトの DNS lookup: 全アドレスを返す。
 */
async function defaultDnsLookup(hostname: string): Promise<string[]> {
  const result = await dnsLookupAsync(hostname, { all: true });
  return result.map((r) => r.address);
}

/**
 * デフォルトのトランスポート: node:https.request で検証済み IP に直接接続。
 *
 * - lookup を上書きして検証済み IP を返すことで、内部的な再解決を防ぐ
 * - servername (SNI) と Host ヘッダを元のホスト名にすることで TLS 検証も成立させる
 */
const defaultTransport: SafeFetchTransport = async (args) => {
  return await new Promise<SafeFetchResponse>((resolve, reject) => {
    const req = https.request(
      {
        host: args.ip,
        servername: args.hostname,
        port: args.port,
        path: args.path,
        method: 'GET',
        headers: {
          ...args.headers,
          Host: args.hostname,
        },
        timeout: args.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        let aborted = false;

        res.on('data', (chunk: Buffer) => {
          if (aborted) return;
          total += chunk.length;
          if (total > args.maxBytes) {
            aborted = true;
            res.destroy();
            reject(new SafeFetchError(`response exceeded max size ${args.maxBytes}`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (aborted) return;
          const status = res.statusCode ?? 0;
          const body = chunks.length === 0 ? null : Buffer.concat(chunks);
          resolve({ status, headers: res.headers, body: status === 304 ? null : body });
        });
        res.on('error', (err) => {
          if (aborted) return;
          reject(new SafeFetchError(`response stream error: ${err.message}`));
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new SafeFetchError(`request timed out after ${args.timeoutMs}ms`));
    });
    req.on('error', (err) => {
      reject(
        err instanceof SafeFetchError ? err : new SafeFetchError(`request error: ${err.message}`)
      );
    });
    req.end();
  });
};

/**
 * セーフフェッチ本体。検証済み URL に対して JSON 取得を試みる。
 *
 * リダイレクトは最大 maxRedirects ホップまで手動で追跡し、各ホップで再検証する。
 */
export async function safeFetchJson(
  rawUrl: string,
  opts: SafeFetchOptions
): Promise<SafeFetchResponse> {
  const maxRedirects = opts.maxRedirects ?? 3;
  const dnsLookup = opts.dnsLookup ?? defaultDnsLookup;
  const transport = opts.transport ?? defaultTransport;

  let currentUrl = rawUrl;
  let hops = 0;

  while (true) {
    const url = ensureUrlShape(currentUrl);
    const ips = await dnsLookup(url.hostname);
    if (ips.length === 0) {
      throw new SafeFetchError(`DNS resolution returned no addresses for ${url.hostname}`);
    }
    for (const ip of ips) {
      if (isPrivateIp(ip)) {
        throw new SafeFetchError(`resolved IP ${ip} is in a forbidden range`);
      }
    }

    const port = url.port ? Number(url.port) : 443;
    const response = await transport({
      hostname: url.hostname,
      ip: ips[0],
      port,
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        ...opts.headers,
      },
      timeoutMs: opts.timeoutMs,
      maxBytes: opts.maxBytes,
    });

    // リダイレクト処理 (3xx with Location)
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = headerString(response.headers['location']);
      if (!location) {
        throw new SafeFetchError(`redirect ${response.status} without Location header`);
      }
      hops += 1;
      if (hops > maxRedirects) {
        throw new SafeFetchError(`too many redirects (>${maxRedirects})`);
      }
      currentUrl = new URL(location, url).href;
      continue;
    }

    // 200 OK の Content-Type は application/json で始まらなければならない
    if (response.status === 200) {
      const contentType = headerString(response.headers['content-type']);
      if (!contentType || !contentType.toLowerCase().startsWith('application/json')) {
        throw new SafeFetchError(
          `expected Content-Type application/json, got "${contentType ?? 'undefined'}"`
        );
      }
    }

    return response;
  }
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
