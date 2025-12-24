# テスト方針

## テストツール

| ツール | 用途 |
|-------|------|
| Vitest | ユニットテスト、統合テスト |
| Supertest | API エンドポイントテスト |
| Testing Library | React コンポーネントテスト |
| Playwright | E2E テスト（将来） |

## テストの種類

### ユニットテスト

個別の関数・クラスをテスト。外部依存はモック。

```typescript
// packages/shared/src/__tests__/validators.test.ts
import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '../validators/schemas';

describe('createProjectSchema', () => {
  it('should validate valid input', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test Project',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = createProjectSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });
});
```

### 統合テスト

複数のコンポーネントを組み合わせてテスト。

```typescript
// apps/api/src/__tests__/integration/projects.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '@agentest/db';

describe('GET /api/v1/projects', () => {
  beforeAll(async () => {
    // テストデータ作成
  });

  afterAll(async () => {
    // クリーンアップ
    await prisma.$disconnect();
  });

  it('should return projects list', async () => {
    const response = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', 'Bearer <token>');

    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
```

### コンポーネントテスト

React コンポーネントの動作をテスト。

```typescript
// apps/web/src/components/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## テストの実行

```bash
# 全テスト実行
docker compose exec dev pnpm test

# 特定パッケージのテスト
docker compose exec dev pnpm --filter @agentest/api test

# ウォッチモード
docker compose exec dev pnpm --filter @agentest/api test:watch

# カバレッジ
docker compose exec dev pnpm --filter @agentest/api test:coverage
```

## ディレクトリ構成

```
apps/api/
├── src/
│   ├── __tests__/
│   │   ├── unit/           # ユニットテスト
│   │   │   └── services/
│   │   └── integration/    # 統合テスト
│   │       └── routes/
│   ├── services/
│   └── routes/
└── vitest.config.ts
```

## テストデータベース

統合テストでは別のデータベースを使用：

```bash
# .env.test
DATABASE_URL=postgresql://agentest:agentest@db:5432/agentest_test
```

## カバレッジ目標

| パッケージ | 目標 |
|-----------|------|
| `packages/shared` | 90% |
| `apps/api` | 80% |
| `apps/web` | 70% |

## CI でのテスト

GitHub Actions で自動実行：

```yaml
- name: Run tests
  run: |
    docker compose exec dev pnpm test
```

## 関連ドキュメント

- [開発フロー](./development.md)
- [API 設計方針](../architecture/api-design.md)
