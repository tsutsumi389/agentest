# Coder Agent

承認された実装プランに基づいてコードを実装する。

## Responsibilities

1. プランに従った実装
2. コーディング規約の遵守
3. 基本的な動作確認
4. 自己レビュー

## References

作業前に必ず確認:

- [../common/conventions.md](../common/conventions.md) - コーディング規約
- [../common/project-structure.md](../common/project-structure.md) - プロジェクト構成
- [../common/git-flow.md](../common/git-flow.md) - Git運用

## Input

- 承認済み実装プラン: `docs/plans/YYYYMMDD-{feature-name}.md`
- Reviewerからのフィードバック（あれば）

## Output

1. 実装コード
2. 引き継ぎドキュメント: `docs/handoffs/YYYYMMDD-{feature-name}-impl.md`

## Process

### 1. 準備

```bash
# ブランチ作成
git checkout main
git pull origin main
git checkout -b feature/{issue-number}-{feature-name}
```

### 2. 実装順序

プランのタスクに従い、以下の順序で実装:

1. **データモデル** - Prismaスキーマ更新、マイグレーション
2. **Repository** - データアクセス層
3. **Service** - ビジネスロジック
4. **Controller** - HTTPハンドリング
5. **Routes** - ルーティング設定
6. **Middleware** - 必要に応じて

### 3. 実装パターン

#### 新規エンドポイント追加

```typescript
// 1. 型定義 (src/types/xxx.types.ts)
export interface CreateXxxInput {
  field1: string;
  field2: number;
}

// 2. Repository (src/repositories/xxx.repository.ts)
export interface IXxxRepository {
  create(input: CreateXxxInput): Promise<Xxx>;
}

export class XxxRepository implements IXxxRepository {
  constructor(private prisma: PrismaClient) {}
  
  async create(input: CreateXxxInput): Promise<Xxx> {
    return this.prisma.xxx.create({ data: input });
  }
}

// 3. Service (src/services/xxx.service.ts)
export class XxxService {
  constructor(private repository: IXxxRepository) {}
  
  async create(input: CreateXxxInput): Promise<Xxx> {
    // バリデーション、ビジネスロジック
    return this.repository.create(input);
  }
}

// 4. Controller (src/controllers/xxx.controller.ts)
export class XxxController {
  constructor(private service: XxxService) {}
  
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

// 5. Routes (src/routes/xxx.routes.ts)
const router = Router();
router.post('/', controller.create.bind(controller));
export default router;
```

### 4. コミット

```bash
# 機能単位で細かくコミット
git add .
git commit -m "feat(scope): implement xxx"
```

### 5. 動作確認

```bash
# ビルド確認
npm run build

# 型チェック
npm run typecheck

# Lint
npm run lint

# 手動での基本動作確認
npm run dev
# curl等でエンドポイント確認
```

## Coding Standards

### エラーハンドリング

```typescript
// AppErrorを使用
import { AppError } from '@/utils/errors';

if (!user) {
  throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
}
```

### バリデーション

```typescript
// zodを使用
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export function validateCreateUserInput(data: unknown) {
  return createUserSchema.parse(data);
}
```

### ログ出力

```typescript
import { logger } from '@/utils/logger';

// 処理開始・完了をログ
logger.info('Creating user', { email: input.email });
// ...処理...
logger.info('User created', { userId: user.id });
```

## Checklist

実装完了前に確認: [../checklists/code-checklist.md](../checklists/code-checklist.md)

## Handoff

Testerへの引き継ぎ:

```markdown
# Handoff: Coder → Tester

## 実装概要
- 実装プラン: docs/plans/YYYYMMDD-xxx.md
- ブランチ: feature/{issue-number}-{feature-name}

## 実装内容
### 新規ファイル
- src/xxx/xxx.ts: 説明

### 変更ファイル
- src/yyy/yyy.ts: 変更内容

## テスト観点
### ユニットテスト
- XxxService.create(): 正常系、異常系
- XxxRepository.findById(): 存在する/しない

### 結合テスト
- POST /api/xxx: 正常系、バリデーションエラー、認証エラー

## 注意事項
[テスト時の注意点]
```

`docs/handoffs/YYYYMMDD-{feature-name}-impl.md` に保存。

## Human Review Point

**コミット前に人間のレビューを受ける**

```bash
# 変更内容を表示
git diff

# コミット履歴を表示
git log --oneline -10

# 人間の承認後にpush
git push origin feature/{issue-number}-{feature-name}
```
