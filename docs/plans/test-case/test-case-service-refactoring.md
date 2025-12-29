# TestCaseServiceのジェネリック関数化（コード重複削減）

## 概要

`TestCaseService`内の前提条件/ステップ/期待結果に対するCRUD操作が、
ほぼ同一のパターンで実装されているため、ジェネリック関数を導入してコード重複を削減する。

## 現状の問題

| メソッド | 前提条件 | ステップ | 期待結果 | 備考 |
|----------|----------|----------|----------|------|
| add | addPrecondition | addStep | addExpectedResult | 同一パターン |
| update | updatePrecondition | updateStep | updateExpectedResult | 同一パターン |
| delete | deletePrecondition | deleteStep | deleteExpectedResult | 同一パターン |
| reorder | reorderPreconditions | reorderSteps | reorderExpectedResults | 同一パターン |
| get | getPreconditions | getSteps | getExpectedResults | 同一パターン |

**重複コード量**: 約600行（各パターン約40行 × 3エンティティ × 5操作）

**問題点**:
- 同一ロジックの修正時に3箇所を変更する必要がある
- バグ修正漏れのリスク
- テストコードも3倍必要

---

## 解決方針

### 方針1: ジェネリック関数 + 設定オブジェクト（推奨）

エンティティごとの差異を設定オブジェクトで吸収し、共通ロジックをジェネリック関数として抽出する。

```typescript
// エンティティ設定の型定義
interface ChildEntityConfig<T> {
  name: string;                    // エンティティ名（エラーメッセージ用）
  model: PrismaModel;              // Prismaモデル
  idField: string;                 // IDフィールド名（preconditionId等）
  changeType: {
    add: string;
    update: string;
    delete: string;
    reorder: string;
  };
}

// 設定オブジェクト
const preconditionConfig: ChildEntityConfig<TestCasePrecondition> = {
  name: 'Precondition',
  model: prisma.testCasePrecondition,
  idField: 'preconditionId',
  changeType: {
    add: 'PRECONDITION_ADD',
    update: 'PRECONDITION_UPDATE',
    delete: 'PRECONDITION_DELETE',
    reorder: 'PRECONDITION_REORDER',
  },
};
```

### 方針2: 抽象クラス + 継承

各エンティティ用のサービスクラスを作成し、共通ロジックを抽象クラスに集約する。

**メリット**: OOP的なアプローチ
**デメリット**: クラス数が増加、オーバーエンジニアリングの懸念

### 採用方針

**方針1（ジェネリック関数 + 設定オブジェクト）を採用**

理由:
- 既存のサービスクラス構造を維持できる
- 設定オブジェクトによる差異の明確化
- テストが容易

---

## 実装タスク

### Task 1: 型定義とヘルパー関数の作成

**ファイル**: `apps/api/src/services/test-case.service.ts`

```typescript
import { Prisma, PrismaClient } from '@agentest/db';

// トランザクションクライアントの型
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// 子エンティティの共通インターフェース
interface ChildEntity {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
}

// エンティティ設定の型
interface ChildEntityConfig {
  name: string;
  snapshotKey: 'preconditions' | 'steps' | 'expectedResults';
  idKey: 'preconditionId' | 'stepId' | 'expectedResultId';
  changeTypes: {
    add: ChildEntityChangeDetail['type'];
    update: ChildEntityChangeDetail['type'];
    delete: ChildEntityChangeDetail['type'];
    reorder: ChildEntityChangeDetail['type'];
  };
  getModel: (tx: TransactionClient) => {
    findFirst: (args: any) => Promise<ChildEntity | null>;
    findMany: (args: any) => Promise<ChildEntity[]>;
    create: (args: any) => Promise<ChildEntity>;
    update: (args: any) => Promise<ChildEntity>;
    delete: (args: any) => Promise<ChildEntity>;
  };
}

// エンティティ設定
const ENTITY_CONFIGS: Record<string, ChildEntityConfig> = {
  precondition: {
    name: 'Precondition',
    snapshotKey: 'preconditions',
    idKey: 'preconditionId',
    changeTypes: {
      add: 'PRECONDITION_ADD',
      update: 'PRECONDITION_UPDATE',
      delete: 'PRECONDITION_DELETE',
      reorder: 'PRECONDITION_REORDER',
    },
    getModel: (tx) => tx.testCasePrecondition,
  },
  step: {
    name: 'Step',
    snapshotKey: 'steps',
    idKey: 'stepId',
    changeTypes: {
      add: 'STEP_ADD',
      update: 'STEP_UPDATE',
      delete: 'STEP_DELETE',
      reorder: 'STEP_REORDER',
    },
    getModel: (tx) => tx.testCaseStep,
  },
  expectedResult: {
    name: 'ExpectedResult',
    snapshotKey: 'expectedResults',
    idKey: 'expectedResultId',
    changeTypes: {
      add: 'EXPECTED_RESULT_ADD',
      update: 'EXPECTED_RESULT_UPDATE',
      delete: 'EXPECTED_RESULT_DELETE',
      reorder: 'EXPECTED_RESULT_REORDER',
    },
    getModel: (tx) => tx.testCaseExpectedResult,
  },
};
```

### Task 2: 共通のadd関数の作成

```typescript
/**
 * 子エンティティを追加する共通関数
 */
private async addChildEntity(
  config: ChildEntityConfig,
  testCaseId: string,
  userId: string,
  data: { content: string; orderKey?: string }
): Promise<ChildEntity> {
  const testCase = await this.findById(testCaseId);

  return prisma.$transaction(async (tx) => {
    const model = config.getModel(tx);

    let orderKey = data.orderKey;
    if (!orderKey) {
      const lastItem = await model.findFirst({
        where: { testCaseId },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = getNextOrderKey(lastItem?.orderKey ?? null);
    }

    const entity = await model.create({
      data: {
        testCaseId,
        content: data.content,
        orderKey,
      },
    });

    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      [config.snapshotKey]: [{ id: entity.id, content: entity.content, orderKey: entity.orderKey }],
      changeDetail: {
        type: config.changeTypes.add,
        [config.idKey]: entity.id,
        added: { content: entity.content, orderKey: entity.orderKey },
      } as ChildEntityChangeDetail,
    };

    await tx.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    return entity;
  });
}

// 公開メソッドは共通関数を呼び出すだけ
async addPrecondition(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
  return this.addChildEntity(ENTITY_CONFIGS.precondition, testCaseId, userId, data);
}

async addStep(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
  return this.addChildEntity(ENTITY_CONFIGS.step, testCaseId, userId, data);
}

async addExpectedResult(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
  return this.addChildEntity(ENTITY_CONFIGS.expectedResult, testCaseId, userId, data);
}
```

### Task 3: 共通のupdate関数の作成

```typescript
/**
 * 子エンティティを更新する共通関数
 */
private async updateChildEntity(
  config: ChildEntityConfig,
  testCaseId: string,
  entityId: string,
  userId: string,
  data: { content: string }
): Promise<ChildEntity> {
  const testCase = await this.findById(testCaseId);

  const entity = await config.getModel(prisma as TransactionClient).findFirst({
    where: { id: entityId, testCaseId },
  });
  if (!entity) {
    throw new NotFoundError(config.name, entityId);
  }

  // 同値更新チェック
  if (entity.content === data.content) {
    return entity;
  }

  return prisma.$transaction(async (tx) => {
    const model = config.getModel(tx);

    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      [config.snapshotKey]: [{ id: entity.id, content: entity.content, orderKey: entity.orderKey }],
      changeDetail: {
        type: config.changeTypes.update,
        [config.idKey]: entityId,
        before: { content: entity.content },
        after: { content: data.content },
      } as ChildEntityChangeDetail,
    };

    await tx.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    return model.update({
      where: { id: entityId },
      data: { content: data.content },
    });
  });
}
```

### Task 4: 共通のdelete関数の作成

```typescript
/**
 * 子エンティティを削除する共通関数
 */
private async deleteChildEntity(
  config: ChildEntityConfig,
  testCaseId: string,
  entityId: string,
  userId: string
): Promise<void> {
  const testCase = await this.findById(testCaseId);

  const entity = await config.getModel(prisma as TransactionClient).findFirst({
    where: { id: entityId, testCaseId },
  });
  if (!entity) {
    throw new NotFoundError(config.name, entityId);
  }

  const snapshot: HistorySnapshot = {
    id: testCase.id,
    testSuiteId: testCase.testSuiteId,
    title: testCase.title,
    description: testCase.description,
    priority: testCase.priority,
    status: testCase.status,
    [config.snapshotKey]: [{ id: entity.id, content: entity.content, orderKey: entity.orderKey }],
    changeDetail: {
      type: config.changeTypes.delete,
      [config.idKey]: entityId,
      deleted: { content: entity.content, orderKey: entity.orderKey },
    } as ChildEntityChangeDetail,
  };

  await prisma.$transaction(async (tx) => {
    const model = config.getModel(tx);

    await tx.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    await model.delete({
      where: { id: entityId },
    });

    // orderKey再整列
    const remaining = await model.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });

    await Promise.all(
      remaining.map((item, i) =>
        model.update({
          where: { id: item.id },
          data: { orderKey: indexToOrderKey(i) },
        })
      )
    );
  });
}
```

### Task 5: 共通のreorder関数の作成

```typescript
/**
 * 子エンティティを並び替える共通関数
 */
private async reorderChildEntities(
  config: ChildEntityConfig,
  testCaseId: string,
  entityIds: string[],
  userId: string
): Promise<ChildEntity[]> {
  const testCase = await this.findById(testCaseId);

  const entities = await config.getModel(prisma as TransactionClient).findMany({
    where: { testCaseId },
    orderBy: { orderKey: 'asc' },
  });

  // 空配列チェック
  if (entities.length === 0 && entityIds.length === 0) {
    return [];
  }

  // 重複IDチェック
  const uniqueIds = new Set(entityIds);
  if (uniqueIds.size !== entityIds.length) {
    throw new BadRequestError(`Duplicate ${config.name.toLowerCase()} IDs are not allowed`);
  }

  // 全件指定チェック
  if (entityIds.length !== entities.length) {
    throw new BadRequestError(`All ${config.name.toLowerCase()} IDs must be provided for reordering`);
  }

  const existingIds = new Set(entities.map((e) => e.id));
  for (const id of entityIds) {
    if (!existingIds.has(id)) {
      throw new NotFoundError(config.name, id);
    }
  }

  // 同値チェック
  const currentOrder = entities.map((e) => e.id);
  const isSameOrder = currentOrder.every((id, index) => id === entityIds[index]);
  if (isSameOrder) {
    return entities;
  }

  const snapshot: HistorySnapshot = {
    id: testCase.id,
    testSuiteId: testCase.testSuiteId,
    title: testCase.title,
    description: testCase.description,
    priority: testCase.priority,
    status: testCase.status,
    [config.snapshotKey]: entities.map((e) => ({ id: e.id, content: e.content, orderKey: e.orderKey })),
    changeDetail: {
      type: config.changeTypes.reorder,
      before: currentOrder,
      after: entityIds,
    } as ChildEntityChangeDetail,
  };

  await prisma.$transaction(async (tx) => {
    const model = config.getModel(tx);

    await tx.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    await Promise.all(
      entityIds.map((id, index) =>
        model.update({
          where: { id },
          data: { orderKey: indexToOrderKey(index) },
        })
      )
    );
  });

  return config.getModel(prisma as TransactionClient).findMany({
    where: { testCaseId },
    orderBy: { orderKey: 'asc' },
  });
}
```

### Task 6: 既存メソッドの置き換え

既存の個別メソッドを共通関数の呼び出しに置き換える。

```typescript
// 前提条件
async addPrecondition(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
  return this.addChildEntity(ENTITY_CONFIGS.precondition, testCaseId, userId, data);
}

async updatePrecondition(testCaseId: string, preconditionId: string, userId: string, data: { content: string }) {
  return this.updateChildEntity(ENTITY_CONFIGS.precondition, testCaseId, preconditionId, userId, data);
}

async deletePrecondition(testCaseId: string, preconditionId: string, userId: string) {
  return this.deleteChildEntity(ENTITY_CONFIGS.precondition, testCaseId, preconditionId, userId);
}

async reorderPreconditions(testCaseId: string, preconditionIds: string[], userId: string) {
  return this.reorderChildEntities(ENTITY_CONFIGS.precondition, testCaseId, preconditionIds, userId);
}

// ステップ、期待結果も同様
```

### Task 7: テストの更新

既存のテストが全てパスすることを確認。
共通関数のユニットテストを追加。

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/services/test-case.service.ts` | ジェネリック関数追加、既存メソッド置き換え |

---

## 実装順序

1. Task 1: 型定義とヘルパー関数の作成
2. Task 2: 共通のadd関数の作成
3. Task 3: 共通のupdate関数の作成
4. Task 4: 共通のdelete関数の作成
5. Task 5: 共通のreorder関数の作成
6. Task 6: 既存メソッドの置き換え
7. Task 7: テストの更新

---

## 期待される効果

| 項目 | Before | After |
|------|--------|-------|
| コード行数 | 約1000行 | 約400行 |
| 重複コード | 約600行 | 0行 |
| バグ修正時の変更箇所 | 3箇所 | 1箇所 |
| 新規エンティティ追加時 | 200行追加 | 設定1つ追加 |

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| 型安全性の低下 | 設定オブジェクトに厳密な型定義 |
| デバッグの複雑化 | エラーメッセージにエンティティ名を含める |
| 既存テストの失敗 | リファクタリング前後でテスト結果を比較 |

---

## テスト観点

- 全ての既存テストがパスすること
- 共通関数が各エンティティで正しく動作すること
- エラーメッセージにエンティティ名が含まれること
- トランザクションの一貫性が保たれること
