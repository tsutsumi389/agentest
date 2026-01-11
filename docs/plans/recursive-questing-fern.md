# テストケース変更履歴の改善プラン

**ステータス: 実装完了**

## 概要
変更履歴の表示形式を変更し、一覧では変更項目のサマリーのみ表示、詳細表示で差分（変更前/後）を表示する。

## 実装結果

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/types/test-case.ts` | `TestCaseChangeDetail`型を追加（共通型） |
| `apps/api/src/services/test-case.service.ts` | `update`メソッドで`changeDetail`を保存、共通型をインポート |
| `apps/web/src/components/test-case/TestCaseHistoryList.tsx` | サマリー表示、折りたたみ式差分表示を実装 |

### 主な実装内容

1. **バックエンド**: 基本情報（タイトル、説明、優先度、ステータス）の更新時に`BASIC_INFO_UPDATE`タイプの`changeDetail`を保存
2. **フロントエンド**: 履歴一覧でサマリー表示、「詳細を見る」ボタンで差分を展開表示
3. **型の共通化**: `TestCaseChangeDetail`型を`@agentest/shared`パッケージに定義し、バックエンド・フロントエンドで共有

## 現状の課題
1. **基本情報（タイトル、説明、優先度、ステータス）の更新時**: 変更後の値のみ保存しており、変更前の値を含む`changeDetail`が保存されていない
2. **フロントエンドの表示**: 変更内容を文字列で表示しているのみで、差分表示機能がない

## 変更対象ファイル

### バックエンド
- `apps/api/src/services/test-case.service.ts` - `update`メソッドで`changeDetail`を追加

### フロントエンド
- `apps/web/src/components/test-case/TestCaseHistoryList.tsx` - サマリー表示と詳細表示の実装

## 実装計画

### Phase 1: バックエンドの修正

#### 1.1 changeDetail型の拡張 (test-case.service.ts)
`ChildEntityChangeDetail`に基本情報変更用の型を追加:

```typescript
| {
    type: 'BASIC_INFO_UPDATE';
    fields: {
      title?: { before: string; after: string };
      description?: { before: string | null; after: string | null };
      priority?: { before: string; after: string };
      status?: { before: string; after: string };
    };
  }
```

#### 1.2 updateメソッドの修正 (test-case.service.ts:295-323)
変更前と変更後の差分を`changeDetail`に保存:

```typescript
async update(testCaseId: string, userId: string, data: {...}) {
  const testCase = await this.findById(testCaseId);

  // 変更があるフィールドのみchangeDetailに含める
  const fields: Record<string, { before: unknown; after: unknown }> = {};
  if (data.title !== undefined && data.title !== testCase.title) {
    fields.title = { before: testCase.title, after: data.title };
  }
  // ... 他のフィールドも同様

  const snapshot: HistorySnapshot = {
    ...testCase基本情報,
    changeDetail: {
      type: 'BASIC_INFO_UPDATE',
      fields,
    },
  };

  // トランザクションで履歴と更新を実行
}
```

### Phase 2: フロントエンドの修正

#### 2.1 変更項目のサマリー表示関数を追加
`getChangedFields`関数: changeDetailから変更されたフィールド名を抽出

```typescript
function getChangedFields(snapshot: Record<string, unknown>): string[] {
  const changeDetail = snapshot.changeDetail as ChangeDetail | undefined;
  if (!changeDetail) return [];

  // type別に変更項目名を返す
  // BASIC_INFO_UPDATE -> 'タイトル', '説明' など
  // PRECONDITION_UPDATE -> '前提条件'
  // STEP_UPDATE -> 'ステップ'
  // など
}
```

#### 2.2 HistoryItemコンポーネントの修正
- サマリー表示: 「タイトル、前提条件を変更」
- 折りたたみ式の詳細表示（クリックでその場で展開）
- 展開時に差分を表示

```tsx
function HistoryItem({ history }: { history: TestCaseHistory }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      {/* 既存のヘッダー部分 */}

      {/* サマリー表示 + 展開ボタン（UPDATEの場合のみ） */}
      <div className="flex items-center gap-2">
        <p>{getChangeSummary(history.snapshot, history.changeType)}</p>
        {history.changeType === 'UPDATE' && hasChangeDetail(history.snapshot) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-accent hover:underline"
          >
            {isExpanded ? '閉じる' : '詳細を見る'}
            <ChevronDown className={isExpanded ? 'rotate-180' : ''} />
          </button>
        )}
      </div>

      {/* 折りたたみ式差分表示 */}
      {isExpanded && (
        <div className="mt-2 pl-4 border-l-2 border-accent">
          <DiffView snapshot={history.snapshot} />
        </div>
      )}
    </div>
  );
}
```

#### 2.3 差分表示コンポーネントの追加
`DiffView`コンポーネント: changeDetailから差分を表示

```tsx
function DiffView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const changeDetail = snapshot.changeDetail;

  return (
    <div className="diff-view">
      {/* フィールドごとに差分を表示 */}
      {/* 赤色の取り消し線で削除、緑色で追加を表示 */}
    </div>
  );
}
```

## 後方互換性

既存の履歴データ（`changeDetail`がないもの）については:
- 基本情報更新時: `snapshot`に変更前の状態が含まれているため、変更後の値は不明として「変更あり」のみ表示
- 子エンティティ更新時: 既に`changeDetail`が保存されているため問題なし

## テスト計画

1. **ユニットテスト**:
   - `update`メソッドで`changeDetail`が正しく保存されることを確認
   - 新しいchangeDetail型のテスト

2. **結合テスト**:
   - 変更履歴APIが正しいデータを返すことを確認

3. **手動テスト**:
   - テストケースのタイトル、説明、優先度、ステータスを変更し履歴を確認
   - 前提条件、ステップ、期待結果を変更し履歴を確認
   - 「詳細を見る」で差分が正しく表示されることを確認
