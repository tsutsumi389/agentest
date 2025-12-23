# Coding Conventions

## Language & Runtime

- TypeScript 5.x (strict mode)
- Node.js 20.x LTS
- Express 4.x
- PostgreSQL 15+

## Naming Conventions

### Files & Directories

```
src/
├── controllers/     # kebab-case: user-auth.controller.ts
├── services/        # kebab-case: user-auth.service.ts
├── repositories/    # kebab-case: user.repository.ts
├── models/          # kebab-case: user.model.ts
├── middlewares/     # kebab-case: auth.middleware.ts
├── routes/          # kebab-case: user.routes.ts
├── utils/           # kebab-case: date-helper.ts
├── types/           # kebab-case: user.types.ts
└── __tests__/       # *.test.ts, *.spec.ts
```

### Code

| Type | Convention | Example |
|------|------------|---------|
| Class | PascalCase | `UserService` |
| Interface | PascalCase + prefix I | `IUserRepository` |
| Type | PascalCase | `UserCreateInput` |
| Function | camelCase | `getUserById` |
| Variable | camelCase | `userName` |
| Constant | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Enum | PascalCase | `UserStatus.Active` |

### Database

- テーブル名: snake_case, 複数形 (`users`, `test_cases`)
- カラム名: snake_case (`created_at`, `user_id`)
- インデックス: `idx_{table}_{columns}`
- 外部キー: `fk_{table}_{ref_table}`

## Code Style

### TypeScript

```typescript
// ✅ Good: 明示的な型定義
interface CreateUserInput {
  email: string;
  name: string;
}

async function createUser(input: CreateUserInput): Promise<User> {
  // implementation
}

// ❌ Bad: any型の使用
async function createUser(input: any): Promise<any> {
  // implementation
}
```

### Error Handling

```typescript
// カスタムエラークラスを使用
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

// 使用例
throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
```

### Async/Await

```typescript
// ✅ Good: try-catchでエラーハンドリング
async function getUser(id: string): Promise<User> {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return user;
  } catch (error) {
    logger.error('Failed to get user', { id, error });
    throw error;
  }
}
```

## Import Order

```typescript
// 1. Node.js built-in modules
import path from 'path';
import fs from 'fs';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (absolute path)
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

// 4. Relative imports
import { validateInput } from './validators';
```

## Comments

```typescript
// 単一行コメント: 処理の補足説明

/**
 * 複数行コメント: 関数・クラスの説明
 * @param id - ユーザーID
 * @returns ユーザー情報
 */

// TODO: 後で実装する内容
// FIXME: 修正が必要な箇所
// NOTE: 重要な注意事項
```

## Logging

```typescript
import { logger } from '@/utils/logger';

// レベル別使用指針
logger.error('Critical error', { error, context });  // 例外、致命的エラー
logger.warn('Warning', { context });                  // 警告、非推奨処理
logger.info('Operation completed', { result });       // 重要な処理完了
logger.debug('Debug info', { details });              // デバッグ情報
```
