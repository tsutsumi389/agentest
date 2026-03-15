import { describe, it, expect, vi, beforeEach } from 'vitest';

// AWS SDKのモック
const mockSend = vi.hoisted(() => vi.fn());
const mockS3Client = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    send: mockSend,
  }))
);

const mockGetSignedUrl = vi.hoisted(() => vi.fn());

// NotFoundエラークラスのモック
const MockNotFound = vi.hoisted(
  () =>
    class MockNotFound extends Error {
      name = 'NotFound';
      constructor(message = 'Not Found') {
        super(message);
      }
    }
);

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input, _type: 'PutObject' })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input, _type: 'GetObject' })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input, _type: 'DeleteObject' })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({ input, _type: 'HeadObject' })),
  ListObjectsV2Command: vi.fn().mockImplementation((input) => ({ input, _type: 'ListObjects' })),
  CopyObjectCommand: vi.fn().mockImplementation((input) => ({ input, _type: 'CopyObject' })),
  NotFound: MockNotFound,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// モック設定後にインポート
import {
  StorageClient,
  createStorageClient,
  createPublicStorageClient,
  type StorageConfig,
} from './client.js';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

// テスト用の設定
const testConfig: StorageConfig = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  bucket: 'test-bucket',
  forcePathStyle: true,
};

describe('StorageClient', () => {
  let client: StorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new StorageClient(testConfig);
  });

  describe('constructor', () => {
    it('S3Clientを正しい設定で初期化する', () => {
      expect(mockS3Client).toHaveBeenCalledWith({
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
        forcePathStyle: true,
      });
    });

    it('regionが指定されない場合はデフォルトでus-east-1を使用する', () => {
      vi.clearAllMocks();
      const configWithoutRegion: StorageConfig = {
        endpoint: 'http://localhost:9000',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        bucket: 'test-bucket',
      };

      new StorageClient(configWithoutRegion);

      expect(mockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
        })
      );
    });

    it('forcePathStyleが指定されない場合はデフォルトでtrueを使用する', () => {
      vi.clearAllMocks();
      const configWithoutForcePathStyle: StorageConfig = {
        endpoint: 'http://localhost:9000',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        bucket: 'test-bucket',
      };

      new StorageClient(configWithoutForcePathStyle);

      expect(mockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          forcePathStyle: true,
        })
      );
    });
  });

  describe('キー検証', () => {
    it('空のキーを拒否する', async () => {
      await expect(client.upload('', Buffer.from('test'))).rejects.toThrow(
        'Storage key must be a non-empty string'
      );
    });

    it('パストラバーサルパターンを含むキーを拒否する', async () => {
      await expect(client.upload('../secret/file.txt', Buffer.from('test'))).rejects.toThrow(
        'Storage key must not contain ".." (path traversal)'
      );
    });

    it('絶対パスを拒否する', async () => {
      await expect(client.upload('/etc/passwd', Buffer.from('test'))).rejects.toThrow(
        'Storage key must not start with "/"'
      );
    });

    it('制御文字を含むキーを拒否する', async () => {
      await expect(client.upload('file\x00.txt', Buffer.from('test'))).rejects.toThrow(
        'Storage key contains invalid characters'
      );
    });

    it('有効なキーを許可する', async () => {
      mockSend.mockResolvedValue({});
      await expect(
        client.upload('valid/path/file.txt', Buffer.from('test'))
      ).resolves.toBeDefined();
    });

    it('全メソッドでキー検証が行われる', async () => {
      const invalidKey = '../traversal';
      const validKey = 'valid-key.txt';

      // download
      await expect(client.download(invalidKey)).rejects.toThrow('path traversal');

      // delete
      await expect(client.delete(invalidKey)).rejects.toThrow('path traversal');

      // exists
      await expect(client.exists(invalidKey)).rejects.toThrow('path traversal');

      // getMetadata
      await expect(client.getMetadata(invalidKey)).rejects.toThrow('path traversal');

      // copy - both source and destination
      await expect(client.copy(invalidKey, validKey)).rejects.toThrow('path traversal');
      await expect(client.copy(validKey, invalidKey)).rejects.toThrow('path traversal');

      // getUploadUrl
      await expect(client.getUploadUrl(invalidKey)).rejects.toThrow('path traversal');

      // getDownloadUrl
      await expect(client.getDownloadUrl(invalidKey)).rejects.toThrow('path traversal');

      // getPublicUrl
      expect(() => client.getPublicUrl(invalidKey)).toThrow('path traversal');
    });
  });

  describe('upload', () => {
    it('ファイルをアップロードしてUploadResultを返す', async () => {
      mockSend.mockResolvedValue({});
      const body = Buffer.from('test content');

      const result = await client.upload('test-key.txt', body, {
        contentType: 'text/plain',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
        Body: body,
        ContentType: 'text/plain',
        Metadata: undefined,
      });
      expect(mockSend).toHaveBeenCalled();
      expect(result).toEqual({
        key: 'test-key.txt',
        url: 'http://localhost:9000/test-bucket/test-key.txt',
        size: body.length,
      });
    });

    it('contentTypeが指定されない場合はapplication/octet-streamを使用する', async () => {
      mockSend.mockResolvedValue({});
      const body = Buffer.from('test content');

      await client.upload('test-key.txt', body);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'application/octet-stream',
        })
      );
    });

    it('メタデータを設定できる', async () => {
      mockSend.mockResolvedValue({});
      const body = Buffer.from('test content');
      const metadata = { 'custom-key': 'custom-value' };

      await client.upload('test-key.txt', body, { metadata });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: metadata,
        })
      );
    });

    it('ACLを設定できる', async () => {
      mockSend.mockResolvedValue({});
      const body = Buffer.from('test content');

      await client.upload('test-key.txt', body, { acl: 'public-read' });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'public-read',
        })
      );
    });

    it('Buffer以外のボディではsizeが0になる', async () => {
      mockSend.mockResolvedValue({});
      const body = 'string content';

      const result = await client.upload('test-key.txt', body);

      expect(result.size).toBe(0);
    });
  });

  describe('download', () => {
    it('ファイルをダウンロードしてレスポンスを返す', async () => {
      const mockResponse = {
        Body: 'mock body',
        ContentType: 'text/plain',
      };
      mockSend.mockResolvedValue(mockResponse);

      const result = await client.download('test-key.txt');

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete', () => {
    it('ファイルを削除する', async () => {
      mockSend.mockResolvedValue({});

      await client.delete('test-key.txt');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('ファイルが存在する場合はtrueを返す', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.exists('test-key.txt');

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
      expect(result).toBe(true);
    });

    it('ファイルが存在しない場合（NotFoundエラー）はfalseを返す', async () => {
      mockSend.mockRejectedValue(new MockNotFound());

      const result = await client.exists('non-existent.txt');

      expect(result).toBe(false);
    });

    it('ファイルが存在しない場合（name=NotFoundエラー）はfalseを返す', async () => {
      const notFoundError = new Error('Not found');
      notFoundError.name = 'NotFound';
      mockSend.mockRejectedValue(notFoundError);

      const result = await client.exists('non-existent.txt');

      expect(result).toBe(false);
    });

    it('ファイルが存在しない場合（name=NoSuchKeyエラー）はfalseを返す', async () => {
      const noSuchKeyError = new Error('Not found');
      noSuchKeyError.name = 'NoSuchKey';
      mockSend.mockRejectedValue(noSuchKeyError);

      const result = await client.exists('non-existent.txt');

      expect(result).toBe(false);
    });

    it('NotFound以外のエラーは再スローする', async () => {
      const networkError = new Error('Network error');
      mockSend.mockRejectedValue(networkError);

      await expect(client.exists('test-key.txt')).rejects.toThrow('Network error');
    });
  });

  describe('getMetadata', () => {
    it('ファイルのメタデータを返す', async () => {
      const lastModified = new Date('2024-01-15T12:00:00Z');
      mockSend.mockResolvedValue({
        ContentType: 'text/plain',
        ContentLength: 100,
        LastModified: lastModified,
        Metadata: { 'custom-key': 'custom-value' },
      });

      const result = await client.getMetadata('test-key.txt');

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
      expect(result).toEqual({
        contentType: 'text/plain',
        contentLength: 100,
        lastModified: lastModified,
        metadata: { 'custom-key': 'custom-value' },
      });
    });

    it('ファイルが存在しない場合（NotFoundエラー）はnullを返す', async () => {
      mockSend.mockRejectedValue(new MockNotFound());

      const result = await client.getMetadata('non-existent.txt');

      expect(result).toBeNull();
    });

    it('ファイルが存在しない場合（name=NotFoundエラー）はnullを返す', async () => {
      const notFoundError = new Error('Not found');
      notFoundError.name = 'NotFound';
      mockSend.mockRejectedValue(notFoundError);

      const result = await client.getMetadata('non-existent.txt');

      expect(result).toBeNull();
    });

    it('NotFound以外のエラーは再スローする', async () => {
      const networkError = new Error('Network error');
      mockSend.mockRejectedValue(networkError);

      await expect(client.getMetadata('test-key.txt')).rejects.toThrow('Network error');
    });
  });

  describe('list', () => {
    it('プレフィックスに一致するファイル一覧を返す', async () => {
      mockSend.mockResolvedValue({
        Contents: [{ Key: 'folder/file1.txt' }, { Key: 'folder/file2.txt' }],
      });

      const result = await client.list('folder/');

      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: 'folder/',
        MaxKeys: 1000,
      });
      expect(result).toEqual(['folder/file1.txt', 'folder/file2.txt']);
    });

    it('maxKeysを指定できる', async () => {
      mockSend.mockResolvedValue({ Contents: [] });

      await client.list('folder/', 100);

      expect(ListObjectsV2Command).toHaveBeenCalledWith(
        expect.objectContaining({
          MaxKeys: 100,
        })
      );
    });

    it('Contentsがない場合は空配列を返す', async () => {
      mockSend.mockResolvedValue({});

      const result = await client.list('empty/');

      expect(result).toEqual([]);
    });

    it('Keyがnullのアイテムはフィルタリングされる', async () => {
      mockSend.mockResolvedValue({
        Contents: [{ Key: 'file1.txt' }, { Key: null }, { Key: 'file2.txt' }],
      });

      const result = await client.list('folder/');

      expect(result).toEqual(['file1.txt', 'file2.txt']);
    });

    it('空のprefixを許可する（ルートリスト用）', async () => {
      mockSend.mockResolvedValue({
        Contents: [{ Key: 'file1.txt' }],
      });

      const result = await client.list('');

      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: '',
        MaxKeys: 1000,
      });
      expect(result).toEqual(['file1.txt']);
    });

    it('パストラバーサルを含むprefixを拒否する', async () => {
      await expect(client.list('../secret/')).rejects.toThrow('path traversal');
    });

    it('絶対パスのprefixを拒否する', async () => {
      await expect(client.list('/etc/')).rejects.toThrow('must not start with "/"');
    });
  });

  describe('copy', () => {
    it('ファイルをコピーする', async () => {
      mockSend.mockResolvedValue({});

      await client.copy('source-key.txt', 'destination-key.txt');

      expect(CopyObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        CopySource: 'test-bucket/source-key.txt',
        Key: 'destination-key.txt',
      });
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('getUploadUrl', () => {
    it('アップロード用署名付きURLを生成する', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/upload');

      const result = await client.getUploadUrl('test-key.txt', {
        contentType: 'text/plain',
        expiresIn: 7200,
      });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
        ContentType: 'text/plain',
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ _type: 'PutObject' }),
        { expiresIn: 7200 }
      );
      expect(result).toBe('https://signed-url.com/upload');
    });

    it('expiresInが指定されない場合はデフォルトで3600を使用する', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/upload');

      await client.getUploadUrl('test-key.txt');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 3600,
      });
    });
  });

  describe('getDownloadUrl', () => {
    it('ダウンロード用署名付きURLを生成する', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/download');

      const result = await client.getDownloadUrl('test-key.txt', {
        expiresIn: 1800,
      });

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key.txt',
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ _type: 'GetObject' }),
        { expiresIn: 1800 }
      );
      expect(result).toBe('https://signed-url.com/download');
    });

    it('expiresInが指定されない場合はデフォルトで3600を使用する', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/download');

      await client.getDownloadUrl('test-key.txt');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 3600,
      });
    });
  });

  describe('getPublicUrl', () => {
    it('公開URLを生成する', () => {
      const result = client.getPublicUrl('test-key.txt');

      expect(result).toBe('http://localhost:9000/test-bucket/test-key.txt');
    });
  });
});

describe('createStorageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('環境変数からStorageClientを作成する', () => {
    const env = {
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ACCESS_KEY: 'my-access-key',
      MINIO_SECRET_KEY: 'my-secret-key',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    createStorageClient(env);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://minio:9000',
        credentials: {
          accessKeyId: 'my-access-key',
          secretAccessKey: 'my-secret-key',
        },
      })
    );
  });

  it('MINIO_ROOT_USER/MINIO_ROOT_PASSWORDをフォールバックとして使用する', () => {
    const env = {
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ROOT_USER: 'root-user',
      MINIO_ROOT_PASSWORD: 'root-password',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    createStorageClient(env);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          accessKeyId: 'root-user',
          secretAccessKey: 'root-password',
        },
      })
    );
  });

  it('環境変数が設定されていない場合はデフォルト値を使用する', () => {
    const env = {} as NodeJS.ProcessEnv;

    createStorageClient(env);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        credentials: {
          accessKeyId: 'agentest',
          secretAccessKey: 'agentest123',
        },
      })
    );
  });

  describe('本番環境での検証', () => {
    it('本番環境でMINIO_ENDPOINTが未設定の場合はエラーをスローする', () => {
      const env = {
        NODE_ENV: 'production',
        MINIO_ACCESS_KEY: 'key',
        MINIO_SECRET_KEY: 'secret',
        MINIO_BUCKET: 'bucket',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createStorageClient(env)).toThrow(
        'MINIO_ENDPOINT is required in production environment'
      );
    });

    it('本番環境でMINIO_ACCESS_KEYが未設定の場合はエラーをスローする', () => {
      const env = {
        NODE_ENV: 'production',
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_SECRET_KEY: 'secret',
        MINIO_BUCKET: 'bucket',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createStorageClient(env)).toThrow(
        'MINIO_ACCESS_KEY is required in production environment'
      );
    });

    it('本番環境でMINIO_SECRET_KEYが未設定の場合はエラーをスローする', () => {
      const env = {
        NODE_ENV: 'production',
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_ACCESS_KEY: 'key',
        MINIO_BUCKET: 'bucket',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createStorageClient(env)).toThrow(
        'MINIO_SECRET_KEY is required in production environment'
      );
    });

    it('本番環境でMINIO_BUCKETが未設定の場合はエラーをスローする', () => {
      const env = {
        NODE_ENV: 'production',
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_ACCESS_KEY: 'key',
        MINIO_SECRET_KEY: 'secret',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createStorageClient(env)).toThrow(
        'MINIO_BUCKET is required in production environment'
      );
    });

    it('本番環境でも全環境変数が設定されていればクライアントを作成できる', () => {
      const env = {
        NODE_ENV: 'production',
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_ACCESS_KEY: 'prod-key',
        MINIO_SECRET_KEY: 'prod-secret',
        MINIO_BUCKET: 'prod-bucket',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createStorageClient(env)).not.toThrow();
      expect(mockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://minio:9000',
          credentials: {
            accessKeyId: 'prod-key',
            secretAccessKey: 'prod-secret',
          },
        })
      );
    });

    it('本番環境でMINIO_ROOT_USER/PASSWORDをフォールバックとして使用できる', () => {
      const env = {
        NODE_ENV: 'production',
        MINIO_ENDPOINT: 'http://minio:9000',
        MINIO_ROOT_USER: 'root-user',
        MINIO_ROOT_PASSWORD: 'root-password',
        MINIO_BUCKET: 'prod-bucket',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createStorageClient(env)).not.toThrow();
      expect(mockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: {
            accessKeyId: 'root-user',
            secretAccessKey: 'root-password',
          },
        })
      );
    });
  });
});

describe('createPublicStorageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MINIO_PUBLIC_ENDPOINTが設定されている場合はそのエンドポイントを使用する', () => {
    const env = {
      MINIO_PUBLIC_ENDPOINT: 'http://localhost:9002',
      MINIO_ACCESS_KEY: 'my-key',
      MINIO_SECRET_KEY: 'my-secret',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    createPublicStorageClient(env);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9002',
      })
    );
  });

  it('MINIO_PUBLIC_ENDPOINTが未設定の場合は通常のクライアントにフォールバックする', () => {
    const env = {
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ACCESS_KEY: 'my-key',
      MINIO_SECRET_KEY: 'my-secret',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    createPublicStorageClient(env);

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://minio:9000',
      })
    );
  });

  it('httpsプロトコルのURLを許可する', () => {
    const env = {
      MINIO_PUBLIC_ENDPOINT: 'https://s3.amazonaws.com',
      MINIO_ACCESS_KEY: 'my-key',
      MINIO_SECRET_KEY: 'my-secret',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    expect(() => createPublicStorageClient(env)).not.toThrow();
  });

  it('不正なプロトコルのURLを拒否する（SSRF対策）', () => {
    const env = {
      MINIO_PUBLIC_ENDPOINT: 'ftp://malicious.com',
      MINIO_ACCESS_KEY: 'my-key',
      MINIO_SECRET_KEY: 'my-secret',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    expect(() => createPublicStorageClient(env)).toThrow(
      'MINIO_PUBLIC_ENDPOINT must use http or https protocol'
    );
  });

  it('不正なURLを拒否する', () => {
    const env = {
      MINIO_PUBLIC_ENDPOINT: 'not-a-url',
      MINIO_ACCESS_KEY: 'my-key',
      MINIO_SECRET_KEY: 'my-secret',
      MINIO_BUCKET: 'my-bucket',
    } as unknown as NodeJS.ProcessEnv;

    expect(() => createPublicStorageClient(env)).toThrow(
      'MINIO_PUBLIC_ENDPOINT is not a valid URL'
    );
  });
});
