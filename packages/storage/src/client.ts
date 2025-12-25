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
   * Upload a file to storage
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
   * Download a file from storage
   */
  async download(key: string): Promise<GetObjectCommandOutput> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return this.client.send(command);
  }

  /**
   * Delete a file from storage
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if a file exists
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
   * Get file metadata
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
   * List files with a prefix
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
   * Copy a file within storage
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
   * Generate a presigned URL for upload
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
   * Generate a presigned URL for download
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
   * Get public URL (for public-read objects)
   */
  getPublicUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}

/**
 * Create storage client from environment variables
 */
export function createStorageClient(env: NodeJS.ProcessEnv = process.env): StorageClient {
  return new StorageClient({
    endpoint: env.MINIO_ENDPOINT || 'http://localhost:9000',
    accessKeyId: env.MINIO_ACCESS_KEY || env.MINIO_ROOT_USER || 'agentest',
    secretAccessKey: env.MINIO_SECRET_KEY || env.MINIO_ROOT_PASSWORD || 'agentest123',
    bucket: env.MINIO_BUCKET || 'agentest',
  });
}
