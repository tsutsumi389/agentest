# テストケースサイドバーにステータスフィルタを追加

## Context

テストケースを削除した後、削除済みテストケースの一覧にアクセスする手段がない。
復元API (`POST /test-cases/:id/restore`) と復元UI (`DeleteTestCaseSection.tsx`) は実装済みだが、削除済みテストケースを**発見する**UIが存在しない。

サイドバーにフィルタを追加し、「アクティブ」「下書き」「アーカイブ」「ゴミ箱」で絞り込めるようにする。デフォルトは「アクティブ」。

## 現状

- **バックエンドAPI**: `GET /api/test-suites/:id/test-cases` は `status`, `includeDeleted` クエリパラメータに対応済み
- **フロントエンドAPI**: `testSuitesApi.getTestCases()` はパラメータを渡していない
- **EntityStatus**: `DRAFT` | `ACTIVE` | `ARCHIVED`（Prisma enum）
- **削除**: ソフトデリート（`deletedAt`フィールド）、30日間の猶予期間で復元可能

## 実装計画

### Step 1: フロントエンドAPIクライアントにフィルタパラメータを追加

**ファイル**: `apps/web/src/lib/api.ts`

`testSuitesApi.getTestCases` にクエリパラメータを渡せるようにする:

```typescript
getTestCases: (testSuiteId: string, params?: { status?: string; includeDeleted?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.includeDeleted) query.set('includeDeleted', 'true');
  const queryString = query.toString();
  return api.get<{ testCases: TestCase[]; total: number }>(
    `/api/test-suites/${testSuiteId}/test-cases${queryString ? `?${queryString}` : ''}`
  );
},
```

### Step 2: サイドバーにフィルタUIを追加

**ファイル**: `apps/web/src/components/test-suite/TestCaseSidebar.tsx`

検索ボックスの下にフィルタボタン群を追加する。

#### フィルタ定義

| フィルタ | ラベル | 条件 | アイコン |
|---------|--------|------|---------|
| `active` | アクティブ | `status=ACTIVE`, `includeDeleted=false` | なし（デフォルト） |
| `draft` | 下書き | `status=DRAFT`, `includeDeleted=false` | `FileEdit` |
| `archived` | アーカイブ | `status=ARCHIVED`, `includeDeleted=false` | `Archive` |
| `deleted` | ゴミ箱 | `includeDeleted=true`, `deletedAt != null` | `Trash2` |

#### UI設計

```
┌─────────────────────────────────┐
│ テストケース              [+]   │
│                                 │
│ 🔍 検索...                      │
│                                 │
│ [アクティブ] [下書き] [アーカイブ] [🗑]│
│                                 │
│  auth/login                ● H  │
│  auth/logout               ● M  │
│                                 │
│ ─ フィルタ「ゴミ箱」選択時 ──── │
│                                 │
│  🗑 auth/signup       残り25日  │
│  🗑 api/sessions      残り 3日⚠│
└─────────────────────────────────┘
```

- フィルタボタンはコンパクトなピル/チップスタイル
- 選択中のフィルタは `bg-accent-subtle text-accent` でハイライト
- ゴミ箱フィルタはアイコンのみ（`Trash2`）で右端に配置
- デフォルトは「アクティブ」が選択状態

#### ゴミ箱表示時の特別UI

- 各テストケースに残り日数バッジを表示
- 残り3日以下は警告色（`text-warning`）
- `SortableTestCaseItem` にゴミ箱フィルタ用の表示モード追加（ドラッグ無効、残り日数表示）
- 空メッセージ: 「削除済みテストケースはありません」

### Step 3: データフェッチをフィルタ対応に変更

**ファイル**: `apps/web/src/pages/TestSuiteCases.tsx`

現在の `testSuitesApi.getTestCases(testSuiteId!)` 呼び出しをフィルタ対応に変更する。

**方針**: フィルタ状態をサイドバー内で管理し、サイドバーが自身でデータフェッチする方式に変更。

変更内容:
1. `TestCaseSidebar` に `testSuiteId` を渡して内部で `useQuery` を使いデータフェッチ
2. サイドバー内でフィルタ状態（`activeFilter`）を `useState` で管理
3. フィルタ変更時に `queryKey` を変更してリフェッチ
4. 親ページ `TestSuiteCases.tsx` は既存の全件取得（`status`指定なし）を維持し、概要表示やテストケース件数表示に使用

```typescript
// サイドバー内部
const [activeFilter, setActiveFilter] = useState<'active' | 'draft' | 'archived' | 'deleted'>('active');

const filterParams = useMemo(() => {
  switch (activeFilter) {
    case 'active': return { status: 'ACTIVE' };
    case 'draft': return { status: 'DRAFT' };
    case 'archived': return { status: 'ARCHIVED' };
    case 'deleted': return { includeDeleted: true };
  }
}, [activeFilter]);

const { data, isLoading } = useQuery({
  queryKey: ['test-suite-cases', testSuiteId, activeFilter],
  queryFn: () => testSuitesApi.getTestCases(testSuiteId, filterParams),
});

// ゴミ箱の場合、deletedAtがnullでないものだけ表示
const filteredCases = activeFilter === 'deleted'
  ? (data?.testCases ?? []).filter(tc => tc.deletedAt != null)
  : (data?.testCases ?? []);
```

### Step 4: ゴミ箱フィルタでのインライン復元対応

**ファイル**: `apps/web/src/components/test-suite/TestCaseSidebar.tsx`

ゴミ箱フィルタ表示時、各テストケースアイテムに:
- 復元ボタン（`RotateCcw` アイコン）をインライン表示
- クリックで `testCasesApi.restore()` を呼び出し
- 復元成功後にクエリを再取得

### Step 5: 削除済みテストケース選択時の詳細パネル対応

**ファイル**: `apps/web/src/pages/TestSuiteCases.tsx`

削除済みテストケースをサイドバーで選択した場合:
- 既存の `TestCaseDetailPanel` で表示（既に `DeleteTestCaseSection` で復元UIが組み込まれている）
- テストケース詳細取得API (`GET /api/test-cases/:id`) は `allowDeletedTestCase: true` オプションで対応済み

## 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/lib/api.ts` | `getTestCases` にパラメータ追加 |
| `apps/web/src/components/test-suite/TestCaseSidebar.tsx` | フィルタUI追加、データフェッチ内包、ゴミ箱表示対応 |
| `apps/web/src/pages/TestSuiteCases.tsx` | サイドバーへのprops調整 |

## 検証方法

1. サイドバーのフィルタボタンでアクティブ/下書き/アーカイブ/ゴミ箱を切り替え、表示が正しく切り替わること
2. デフォルトで「アクティブ」が選択されていること
3. テストケース削除後、ゴミ箱フィルタに削除済みテストケースが表示されること
4. ゴミ箱内のテストケースをクリックして詳細表示し、復元ボタンで復元できること
5. 復元後、テストケースがアクティブフィルタに戻ること
6. ゴミ箱フィルタ時にドラッグ&ドロップが無効であること
7. 検索がフィルタと組み合わせて動作すること
