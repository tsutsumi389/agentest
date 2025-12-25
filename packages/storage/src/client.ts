import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: options.metadata,
      ACL: options.acl || 'private',
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
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
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
    } catch {
      return null;
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
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}

/**
 * 環境変数からストレージクライアントを作成
 */
export function createStorageClient(env: NodeJS.ProcessEnv = process.env): StorageClient {
  return new StorageClient({
    endpoint: env.MINIO_ENDPOINT || 'http://localhost:9000',
    accessKeyId: env.MINIO_ACCESS_KEY || env.MINIO_ROOT_USER || 'agentest',
    secretAccessKey: env.MINIO_SECRET_KEY || env.MINIO_ROOT_PASSWORD || 'agentest123',
    bucket: env.MINIO_BUCKET || 'agentest',
  });
}
