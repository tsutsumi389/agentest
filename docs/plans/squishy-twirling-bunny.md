# プロジェクト物理削除バッチジョブ 実装計画

## 概要

削除（ソフトデリート）から30日以上経過したプロジェクトを物理削除するバッチジョブを作成する。

## 変更ファイル

### 新規作成

| ファイル | 説明 |
|---------|------|
| `apps/jobs/src/jobs/project-cleanup.ts` | ジョブ本体 |
| `apps/jobs/src/__tests__/unit/project-cleanup.test.ts` | ユニットテスト |
| `apps/jobs/src/__tests__/integration/project-cleanup.integration.test.ts` | 統合テスト |

### 変更

| ファイル | 変更内容 |
|---------|----------|
| `apps/jobs/src/index.ts` | `project-cleanup` ジョブを登録 |
| `apps/jobs/src/lib/constants.ts` | `PROJECT_CLEANUP_DAYS = 30` 定数追加 |
| `apps/jobs/src/__tests__/integration/test-helpers.ts` | `createDeletedTestProject` ヘルパー追加 |

## 実装詳細

### 1. constants.ts

```typescript
/** プロジェクト物理削除までの日数 */
export const PROJECT_CLEANUP_DAYS = 30;
```

### 2. project-cleanup.ts

```typescript
/**
 * プロジェクトクリーンアップジョブ
 * deletedAtから30日以上経過したプロジェクトを物理削除
 * 毎日 4:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { DEFAULT_BATCH_SIZE, PROJECT_CLEANUP_DAYS } from '../lib/constants.js';

export async function runProjectCleanup(): Promise<void> {
  let cursor: string | undefined;
  let totalDeleted = 0;

  // 削除基準日を算出（30日前）
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - PROJECT_CLEANUP_DAYS);

  console.log(
    `削除対象: deletedAtが${PROJECT_CLEANUP_DAYS}日以上前のプロジェクト（基準日: ${cutoffDate.toISOString()}）`
  );

  do {
    // カーソルベースでソフトデリート済みプロジェクトを取得
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
      take: DEFAULT_BATCH_SIZE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, deletedAt: true },
    });

    if (projects.length === 0) break;

    // 各プロジェクトを物理削除
    for (const project of projects) {
      try {
        console.log(
          `プロジェクト削除開始: ${project.id} (${project.name}) - deletedAt: ${project.deletedAt?.toISOString()}`
        );

        // 物理削除（カスケードで関連データも削除される）
        await prisma.project.delete({
          where: { id: project.id },
        });

        totalDeleted++;
        console.log(`プロジェクト削除完了: ${project.id}`);
      } catch (error) {
        // 個別のエラーは記録して続行
        console.error(`プロジェクト削除失敗: ${project.id}`, error);
      }
    }

    cursor = projects[projects.length - 1]?.id;
  } while (cursor);

  console.log(`合計 ${totalDeleted} 件のプロジェクトを物理削除しました`);

  // 残りのソフトデリート済みプロジェクト数をレポート
  const remainingCount = await prisma.project.count({
    where: {
      deletedAt: { not: null },
    },
  });
  console.log(`残りのソフトデリート済みプロジェクト: ${remainingCount}件`);
}
```

### 3. index.ts への追加

```typescript
import { runProjectCleanup } from './jobs/project-cleanup.js';

const jobs: Record<string, () => Promise<void>> = {
  // 既存ジョブ...
  'project-cleanup': runProjectCleanup,
};
```

## カスケード削除対象

Prismaの`onDelete: Cascade`設定により、プロジェクト削除時に以下が自動削除される：

- ProjectMember, ProjectEnvironment, ProjectHistory
- AgentSession, Label
- TestSuite → TestCase → TestCaseStep, TestCaseExpectedResult, TestCasePrecondition
- Execution → ExecutionTestCase, ExecutionStepResult, ExecutionEvidence等

## テスト計画

### ユニットテスト
- 30日以上前のdeletedAtのプロジェクトを削除する
- カーソルベースバッチ処理が正しく動作する
- 削除対象がない場合でも正常に完了する
- 個別エラー発生時も処理を続行する

### 統合テスト
- 31日前に削除されたプロジェクトを物理削除する
- 29日前に削除されたプロジェクトは削除されない
- deletedAtがnullのプロジェクトは削除されない
- カスケード削除で関連データも削除される

## 検証方法

```bash
# テスト実行
docker compose exec dev pnpm --filter @agentest/jobs test

# ビルド確認
docker compose exec dev pnpm --filter @agentest/jobs build

# 手動実行（開発環境）
docker compose exec dev pnpm --filter @agentest/jobs dev
# JOB_NAME=project-cleanup で実行
```
