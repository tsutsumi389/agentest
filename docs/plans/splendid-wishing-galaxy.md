# 通知機能実装計画 - テスト完了/失敗通知

## 概要

テスト実行の完了・失敗時に通知を送信する機能を実装する。

## 仕様

### 完了判定条件

- 全ての期待結果（ExecutionExpectedResult）が「未判定（PENDING）以外」になったら完了
- ステップ・前提条件の状態は判定に含めない
- テスト実行（Execution）自体にはステータスを持たない

### 通知トリガー

| 条件 | 通知タイプ |
|------|-----------|
| 完了時に FAIL が1件以上 | TEST_FAILED |
| 完了時に FAIL がない（PASS/SKIPPEDのみ） | TEST_COMPLETED |

### 通知内容

期待結果の内訳を含める：
- 成功（PASS）件数
- 失敗（FAIL）件数
- スキップ（SKIPPED）件数
- 合計件数

### スコープ外

- 失敗時の即時通知
- テスト中止時の対応

---

## 実装計画

### Phase 1: ExecutionServiceの更新

**ファイル**: `apps/api/src/services/execution.service.ts`

1. `updateExpectedResult()` メソッドに完了判定ロジックを追加
2. `checkAndSendCompletionNotification()` プライベートメソッドを新規作成

```typescript
// 期待結果更新後に呼び出す
private async checkAndSendCompletionNotification(
  executionId: string,
  testSuite: { id: string; name: string; projectId: string },
  executorUserId?: string
): Promise<void> {
  // 1. 全期待結果を取得
  const allResults = await this.repository.findAllExpectedResults(executionId);

  // 2. PENDINGがあれば終了
  const pendingCount = allResults.filter(r => r.status === 'PENDING').length;
  if (pendingCount > 0) return;

  // 3. 内訳を計算
  const passCount = allResults.filter(r => r.status === 'PASS').length;
  const failCount = allResults.filter(r => r.status === 'FAIL').length;
  const skippedCount = allResults.filter(r => r.status === 'SKIPPED').length;

  // 4. 通知送信
  const execution = await this.repository.findById(executionId);
  const notificationType = failCount > 0 ? 'TEST_FAILED' : 'TEST_COMPLETED';

  await this.notificationService.send({
    userId: execution.executedByUserId,
    type: notificationType,
    title: failCount > 0
      ? 'テスト実行が失敗しました'
      : 'テスト実行が完了しました',
    body: this.buildNotificationBody(testSuite.name, { passCount, failCount, skippedCount }),
    data: {
      executionId,
      testSuiteId: testSuite.id,
      testSuiteName: testSuite.name,
      passCount,
      failCount,
      skippedCount,
      totalCount: allResults.length
    }
  });
}
```

### Phase 2: NotificationServiceの確認・更新

**ファイル**: `apps/api/src/services/notification.service.ts`

1. `TEST_COMPLETED` と `TEST_FAILED` の通知タイプが対応していることを確認
2. 必要であれば通知タイプを追加

### Phase 3: 通知設定への対応

**ファイル**:
- `apps/api/src/services/notification-preference.service.ts`
- `packages/db/prisma/schema.prisma`（必要に応じて）

1. 通知設定で `TEST_COMPLETED` / `TEST_FAILED` の有効/無効を切り替え可能にする
2. 送信前に通知設定をチェックするロジックを追加

### Phase 4: ユニットテスト

**ファイル**: `apps/api/src/services/__tests__/execution.service.test.ts`

テストケース：
1. 全てPASSで完了 → TEST_COMPLETED通知
2. FAILが1件以上で完了 → TEST_FAILED通知
3. 全てSKIPPEDで完了 → TEST_COMPLETED通知
4. PENDINGが残っている → 通知しない
5. 通知設定で無効化 → 通知しない

---

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/services/execution.service.ts` | 完了判定・通知送信ロジック追加 |
| `apps/api/src/repositories/execution.repository.ts` | 期待結果一括取得メソッド追加（必要に応じて） |
| `apps/api/src/services/notification.service.ts` | 通知タイプ対応確認・更新 |
| `apps/api/src/services/__tests__/execution.service.test.ts` | ユニットテスト追加 |

---

## 検証方法

1. **ユニットテスト**: `docker compose exec dev pnpm test` で全テスト実行
2. **手動テスト**:
   - テスト実行を作成
   - 期待結果を順番に判定（PASS/FAIL/SKIPPED）
   - 最後の期待結果を判定した時点で通知が送信されることを確認
   - 通知の内訳（成功・失敗・スキップ件数）が正しいことを確認
