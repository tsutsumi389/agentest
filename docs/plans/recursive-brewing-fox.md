# ProjectEnvironment.slug フィールド削除計画

## 概要
環境（ProjectEnvironment）のslugフィールドは、URLルーティングには使われておらず実質的な用途がないため削除する。

## 変更対象ファイル（17ファイル）

### Phase 1: 共有パッケージ
| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/types/organization.ts` | `ProjectEnvironment`インターフェースからslugを削除 |
| `packages/shared/src/validators/schemas.ts` | `projectEnvironmentSchema`と`projectEnvironmentUpdateSchema`からslugを削除 |

### Phase 2: Prismaスキーマ
| ファイル | 変更内容 |
|----------|----------|
| `packages/db/prisma/schema.prisma` | `slug`フィールドと`@@unique([projectId, slug])`を削除 |
| `packages/db/prisma/seed.ts` | `projectId_slug`のwhere条件をID指定に変更、createからslugを削除 |

### Phase 3: API
| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/services/project.service.ts` | createEnvironment/updateEnvironmentからslug重複チェックを削除 |

### Phase 4: フロントエンド
| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/lib/api.ts` | 型定義からslugを削除 |
| `apps/web/src/components/project/EnvironmentFormModal.tsx` | slug入力フィールド・自動生成ロジック・バリデーションを削除 |

### Phase 5: MCPサーバー
| ファイル | 変更内容 |
|----------|----------|
| `apps/mcp-server/src/tools/get-project.ts` | 型定義からslugを削除 |
| `apps/mcp-server/src/tools/search-execution.ts` | environment型からslugを削除 |
| `apps/mcp-server/src/tools/get-execution.ts` | environment型からslugを削除 |

### Phase 6: テスト
| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/__tests__/integration/test-helpers.ts` | `createTestEnvironment`からslugを削除 |
| `apps/api/src/__tests__/integration/project-environments.integration.test.ts` | slug関連テストケースを削除 |
| `apps/api/src/__tests__/unit/project.service.environment.test.ts` | slug関連テストを削除 |
| `apps/mcp-server/src/__tests__/unit/tools/get-project.test.ts` | モックからslugを削除 |
| `apps/mcp-server/src/__tests__/unit/tools/get-execution.test.ts` | モック・アサーションからslugを削除 |
| `apps/mcp-server/src/__tests__/unit/tools/search-execution.test.ts` | モック・型からslugを削除 |

### Phase 7: マイグレーション実行
```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name remove_project_environment_slug
```

## 検証方法

```bash
# 全テスト実行
docker compose exec dev pnpm test

# Lint
docker compose exec dev pnpm lint

# ビルド確認
docker compose exec dev pnpm build
```
