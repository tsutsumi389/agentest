# Tester Agent

実装に対するユニットテスト・結合テストを作成・実行する。

## Responsibilities

1. ユニットテスト作成
2. 結合テスト作成
3. テスト実行・結果報告
4. カバレッジ確認

## References

作業前に確認:

- [../common/conventions.md](../common/conventions.md) - コーディング規約
- [../common/project-structure.md](../common/project-structure.md) - テストファイル配置

## Input

- Coderからの引き継ぎ: `docs/handoffs/YYYYMMDD-{feature-name}-impl.md`
- 実装コード

## Output

1. テストコード
2. テスト結果レポート
3. 引き継ぎドキュメント: `docs/handoffs/YYYYMMDD-{feature-name}-test.md`

## Test Framework

**Vitest** を使用。

```bash
# インストール
npm install -D vitest @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'src/__tests__/fixtures'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## Test Structure

```
src/__tests__/
├── unit/
│   ├── services/
│   │   └── xxx.service.test.ts
│   └── repositories/
│       └── xxx.repository.test.ts
└── integration/
    └── api/
        └── xxx.api.test.ts
```

## Process

### 1. テスト計画

引き継ぎドキュメントのテスト観点を確認し、テストケースをリストアップ。

### 2. ユニットテスト作成

#### Service テスト

```typescript
// src/__tests__/unit/services/user.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '@/services/user.service';
import { IUserRepository } from '@/repositories/user.repository';
import { AppError } from '@/utils/errors';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: IUserRepository;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
    };
    service = new UserService(mockRepository);
  });

  describe('create', () => {
    const validInput = { email: 'test@example.com', name: 'Test' };

    it('should create user when email is unique', async () => {
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockRepository.create).mockResolvedValue({ id: '1', ...validInput });

      const result = await service.create(validInput);

      expect(result.email).toBe(validInput.email);
      expect(mockRepository.create).toHaveBeenCalledWith(validInput);
    });

    it('should throw error when email already exists', async () => {
      vi.mocked(mockRepository.findByEmail).mockResolvedValue({ id: '1', ...validInput });

      await expect(service.create(validInput)).rejects.toThrow(AppError);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});
```

#### Repository テスト（Prismaモック）

```typescript
// src/__tests__/unit/repositories/user.repository.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '@/repositories/user.repository';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
    repository = new UserRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('1');

      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });
});
```

### 3. 結合テスト作成

```typescript
// src/__tests__/integration/api/user.api.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/utils/prisma';

describe('User API', () => {
  beforeAll(async () => {
    // テストDB準備
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // テストデータクリア
    await prisma.user.deleteMany();
  });

  describe('POST /api/users', () => {
    const validInput = { email: 'test@example.com', name: 'Test' };

    it('should create user and return 201', async () => {
      const response = await request(app)
        .post('/api/users')
        .send(validInput)
        .expect(201);

      expect(response.body.email).toBe(validInput.email);
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ email: 'invalid', name: 'Test' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate email', async () => {
      // 先にユーザー作成
      await request(app).post('/api/users').send(validInput);

      // 同じメールで再作成
      const response = await request(app)
        .post('/api/users')
        .send(validInput)
        .expect(409);

      expect(response.body.code).toBe('EMAIL_EXISTS');
    });
  });
});
```

### 4. テスト実行

```bash
# 全テスト実行
npx vitest run

# Watchモード（開発中に便利）
npx vitest

# ユニットテストのみ
npx vitest run --dir src/__tests__/unit

# 結合テストのみ
npx vitest run --dir src/__tests__/integration

# カバレッジ付き
npx vitest run --coverage

# 特定ファイル
npx vitest run user.service.test.ts

# UIモード（ブラウザで確認）
npx vitest --ui
```

### 5. カバレッジ基準

| 指標 | 最低基準 | 目標 |
|------|----------|------|
| Line Coverage | 80% | 90% |
| Branch Coverage | 75% | 85% |
| Function Coverage | 80% | 90% |

## Test Patterns

### 正常系

- 期待される入力での正常動作
- 境界値での動作

### 異常系

- バリデーションエラー
- 存在しないリソースへのアクセス
- 権限エラー
- 重複エラー

### エッジケース

- 空配列、空文字
- null, undefined
- 最大長、最小長

## Vitest Tips

### モック

```typescript
import { vi } from 'vitest';

// 関数モック
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');

// モジュールモック
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// スパイ
const spy = vi.spyOn(object, 'method');
```

### タイマー

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should timeout', async () => {
  vi.advanceTimersByTime(1000);
});
```

## Checklist

テスト完了前に確認: [../checklists/test-checklist.md](../checklists/test-checklist.md)

## Handoff

Documenterへの引き継ぎ:

```markdown
# Handoff: Tester → Documenter

## テスト結果サマリー
- ユニットテスト: XX passed, X failed
- 結合テスト: XX passed, X failed
- カバレッジ: XX%

## 新規テストファイル
- src/__tests__/unit/services/xxx.service.test.ts
- src/__tests__/integration/api/xxx.api.test.ts

## ドキュメント更新が必要な箇所
- API仕様: POST /api/xxx の追加
- 環境変数: XXX_YYY の追加

## 注意事項
[ドキュメント作成時の注意点]
```

`docs/handoffs/YYYYMMDD-{feature-name}-test.md` に保存。
