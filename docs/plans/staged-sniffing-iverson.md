# テストケース変更履歴のグループ化

## 概要

同じトランザクション（APIリクエスト）で行った変更を1つの履歴項目としてまとめて表示する。

## 要件

- 同一トランザクション内の変更を1つのグループとして表示
- 既存データ（groupIdがNULL）はグループ化せず個別表示のまま
- サマリー: どの項目を変更したか表示（例: 「タイトル、ステップを変更」）
- 詳細: 変更内容を前後比較で表示（既存の`DiffView`を活用）

## 実装ステップ

### 1. DBスキーマ変更

**ファイル:** `packages/db/prisma/schema.prisma`

```prisma
model TestCaseHistory {
  // ... 既存フィールド ...
  groupId  String?  @map("group_id") @db.VarChar(36)  // 追加

  @@index([testCaseId, groupId])  // 追加
}
```

マイグレーション実行: `pnpm db:migrate`

### 2. バックエンド変更

**ファイル:** `apps/api/src/services/test-case.service.ts`

各履歴作成メソッドで`groupId`を付与:

```typescript
// トランザクション開始時にgroupIdを生成
const groupId = crypto.randomUUID();

await tx.testCaseHistory.create({
  data: {
    // ... 既存データ ...
    groupId,  // 追加
  },
});
```

**対象メソッド（約15箇所）:**
- `update()`, `softDelete()`, `restore()`, `copy()`
- `addPrecondition()`, `updatePrecondition()`, `deletePrecondition()`, `reorderPreconditions()`
- `addStep()`, `updateStep()`, `deleteStep()`, `reorderSteps()`
- `addExpectedResult()`, `updateExpectedResult()`, `deleteExpectedResult()`, `reorderExpectedResults()`
- `updateWithChildren()`

### 3. 型定義追加

**ファイル:** `packages/shared/src/types/test-case.ts`

```typescript
export interface TestCaseHistoryGroup {
  groupId: string;
  histories: TestCaseHistory[];
  createdAt: Date;
}
```

**ファイル:** `apps/web/src/lib/api.ts`

`TestCaseHistory`型に`groupId`を追加。

### 4. フロントエンド変更

**ファイル:** `apps/web/src/components/test-case/TestCaseHistoryList.tsx`

#### 4.1 グループ化ロジック

```typescript
function groupHistories(histories: TestCaseHistory[]): (TestCaseHistory | TestCaseHistoryGroup)[] {
  const result: (TestCaseHistory | TestCaseHistoryGroup)[] = [];
  const groupMap = new Map<string, TestCaseHistory[]>();

  for (const history of histories) {
    if (history.groupId) {
      // groupIdがある場合はグループ化
      const group = groupMap.get(history.groupId) || [];
      group.push(history);
      groupMap.set(history.groupId, group);
    } else {
      // groupIdがない場合は個別表示
      result.push(history);
    }
  }

  // グループをresultに追加
  for (const [groupId, group] of groupMap) {
    result.push({ groupId, histories: group, createdAt: group[0].createdAt });
  }

  // createdAtでソート
  return result.sort((a, b) => ...);
}
```

#### 4.2 グループ表示コンポーネント

```typescript
function HistoryGroupItem({ group }: { group: TestCaseHistoryGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // サマリー: グループ内の全変更項目を集約
  const changedItems = group.histories.flatMap(h => getChangedFields(h.snapshot));
  const summary = [...new Set(changedItems)].join('、') + 'を変更';

  return (
    <div>
      {/* サマリー表示 */}
      <div onClick={() => setIsExpanded(!isExpanded)}>
        {summary} [▼]
      </div>

      {/* 詳細展開時: 各変更の前後比較 */}
      {isExpanded && group.histories.map(h => (
        <DiffView snapshot={h.snapshot} />
      ))}
    </div>
  );
}
```

**UI例:**
```
[更新] 山田太郎
タイトル、ステップ、期待結果を変更  [▼ 詳細を見る]
2分前
  ├─ タイトル: 「旧タイトル」→「新タイトル」
  ├─ ステップ追加: 「ボタンをクリック」
  └─ 期待結果更新: 「エラー表示」→「成功メッセージ表示」
```

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | groupIdカラム追加 |
| `apps/api/src/services/test-case.service.ts` | 履歴作成時にgroupId付与 |
| `packages/shared/src/types/test-case.ts` | グループ型定義追加 |
| `apps/web/src/lib/api.ts` | TestCaseHistory型にgroupId追加 |
| `apps/web/src/components/test-case/TestCaseHistoryList.tsx` | グループ化表示UI実装 |

## 検証方法

1. マイグレーション成功確認
2. テストケースの複数フィールドを同時更新
3. 変更履歴画面で1つのグループとして表示されることを確認
4. グループの展開/折りたたみ動作確認
5. 既存データ（groupIdがNULL）が個別に表示されることを確認
