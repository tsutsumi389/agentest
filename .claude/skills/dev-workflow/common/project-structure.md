# Project Structure

## Directory Layout

```
project-root/
├── src/
│   ├── controllers/        # HTTPリクエスト処理
│   ├── services/           # ビジネスロジック
│   ├── repositories/       # データアクセス層
│   ├── models/             # データモデル定義
│   ├── middlewares/        # Expressミドルウェア
│   ├── routes/             # ルーティング定義
│   ├── utils/              # ユーティリティ関数
│   ├── types/              # TypeScript型定義
│   ├── config/             # 設定ファイル
│   ├── __tests__/          # テストファイル
│   │   ├── unit/           # ユニットテスト
│   │   └── integration/    # 結合テスト
│   ├── app.ts              # Expressアプリ設定
│   └── server.ts           # サーバー起動
├── prisma/                  # Prismaスキーマ・マイグレーション
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   ├── api/                # API仕様書
│   ├── plans/              # 実装プラン
│   └── handoffs/           # エージェント間引き継ぎ
├── scripts/                 # ユーティリティスクリプト
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Layer Responsibilities

### Controllers

HTTPリクエスト/レスポンス処理のみ。

```typescript
// src/controllers/user.controller.ts
export class UserController {
  constructor(private userService: UserService) {}

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = validateCreateUserInput(req.body);
      const user = await this.userService.create(input);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }
}
```

### Services

ビジネスロジックを実装。

```typescript
// src/services/user.service.ts
export class UserService {
  constructor(private userRepository: IUserRepository) {}

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
    }
    return this.userRepository.create(input);
  }
}
```

### Repositories

データアクセスを抽象化。

```typescript
// src/repositories/user.repository.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}

export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

## Configuration

### Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d

# Logging
LOG_LEVEL=debug
```

### Config Module

```typescript
// src/config/index.ts
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
};
```

## Dependency Injection

シンプルな手動DI:

```typescript
// src/container.ts
import { PrismaClient } from '@prisma/client';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';

const prisma = new PrismaClient();

const userRepository = new UserRepository(prisma);
const userService = new UserService(userRepository);
const userController = new UserController(userService);

export { userController };
```
