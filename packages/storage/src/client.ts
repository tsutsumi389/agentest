import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  NotFound,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3エラーがNotFoundエラーかどうかを判定
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof NotFound) {
    return true;
  }
  // S3クライアントは他の形式でNotFoundを返すことがある
  if (error instanceof Error && error.name === 'NotFound') {
    return true;
  }
  // HeadObjectはNoSuchKeyではなく404エラーコードを返すことがある
  if (
    error instanceof Error &&
    'name' in error &&
    (error.name === 'NoSuchKey' || error.name === '404')
  ) {
    return true;
  }
  return false;
}

/**
 * ストレージキーを検証（パストラバーサル攻撃を防ぐ）
 */
function validateKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Storage key must be a non-empty string');
  }
  // パストラバーサルパターンを検出
  if (key.includes('..')) {
    throw new Error('Storage key must not contain ".." (path traversal)');
  }
  // 絶対パスを禁止
  if (key.startsWith('/')) {
    throw new Error('Storage key must not start with "/"');
  }
  // 危険な文字をチェック
  const invalidChars = /[\x00-\x1f\x7f]/;
  if (invalidChars.test(key)) {
    throw new Error('Storage key contains invalid characters');
  }
}

export interface StorageConfig {
  endpoint: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 3600
  contentType?: string;
}

export class StorageClient {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  /**
   * ストレージにファイルをアップロード
   */
  async upload(
    key: string,
    body: Buffer | Uint8Array | string | ReadableStream,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    validateKey(key);
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: options.metadata,
      // ACLはMinIOで無効な場合があるため、明示的に指定された場合のみ設定
      ...(options.acl && { ACL: options.acl }),
    };

    await this.client.send(new PutObjectCommand(params));

    const size = body instanceof Buffer ? body.length : 0;

    return {
      key,
      url: this.getPublicUrl(key),
      size,
    };
  }

  /**
   * ストレージからファイルをダウンロード
   */
  async download(key: string): Promise<GetObjectCommandOutput> {
    validateKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return this.client.send(command);
  }

  /**
   * ストレージからファイルを削除
   */
  async delete(key: string): Promise<void> {
    validateKey(key);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * ファイルの存在確認
   */
  async exists(key: string): Promise<boolean> {
    validateKey(key);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * ファイルのメタデータを取得
   */
  async getMetadata(key: string): Promise<{
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
    metadata?: Record<string, string>;
  } | null> {
    validateKey(key);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * プレフィックスでファイル一覧を取得
   */
  async list(prefix: string, maxKeys = 1000): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await this.client.send(command);
    return response.Contents?.map((item) => item.Key!).filter(Boolean) || [];
  }

  /**
   * ストレージ内でファイルをコピー
   */
  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    validateKey(sourceKey);
    validateKey(destinationKey);
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });

    await this.client.send(command);
  }

  /**
   * アップロード用の署名付きURLを生成
   */
  async getUploadUrl(key: string, options: PresignedUrlOptions = {}): Promise<string> {
    validateKey(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  /**
   * ダウンロード用の署名付きURLを生成
   */
  async getDownloadUrl(key: string, options: PresignedUrlOptions = {}): Promise<string> {
    validateKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  /**
   * 公開URL取得（public-readオブジェクト用）
   */
  getPublicUrl(key: string): string {
    validateKey(key);
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}

/**
 * 本番環境で必須の環境変数を取得
 */
function getRequiredEnvVar(
  env: NodeJS.ProcessEnv,
  key: string,
  fallbackKey: string | undefined,
  defaultValue: string
): string {
  const value = env[key] || (fallbackKey ? env[fallbackKey] : undefined);
  if (value) {
    return value;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error(`${key} is required in production environment`);
  }
  return defaultValue;
}

/**
 * 環境変数からストレージクライアントを作成
 */
export function createStorageClient(env: NodeJS.ProcessEnv = process.env): StorageClient {
  return new StorageClient({
    endpoint: getRequiredEnvVar(env, 'MINIO_ENDPOINT', undefined, 'http://localhost:9000'),
    accessKeyId: getRequiredEnvVar(env, 'MINIO_ACCESS_KEY', 'MINIO_ROOT_USER', 'agentest'),
    secretAccessKey: getRequiredEnvVar(env, 'MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD', 'agentest123'),
    bucket: getRequiredEnvVar(env, 'MINIO_BUCKET', undefined, 'agentest'),
  });
}
