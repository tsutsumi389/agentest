# Step 11: フロントエンド - @参照入力UI（TC-004）実装計画

## 概要

テストケース作成時のタイトル入力欄で`@`を入力すると、同一プロジェクト内のテストスイート・テストケースを参照し、選択したテストケースの内容をコピーできる機能を実装する。

**入力例:** `@ログイン機能/正常系ログイン`

---

## 前提条件

- バックエンドAPI実装済み:
  - `GET /api/projects/:projectId/suggestions/test-suites?q=&limit=10`
  - `GET /api/test-suites/:testSuiteId/suggestions/test-cases?q=&limit=10`
- フロントエンドAPI関数実装済み（`api.ts:645`, `709`行目）

---

## 実装ステップ

### Step 1: useDebounceフック作成

**新規作成:** `apps/web/src/hooks/useDebounce.ts`

```typescript
export function useDebounce<T>(value: T, delay: number = 300): T
```

- 汎用デバウンスフック
- API呼び出しの最適化に使用

---

### Step 2: MentionInputコンポーネント実装

**新規作成:** `apps/web/src/components/common/MentionInput.tsx`

#### Props

```typescript
interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  onTestCaseSelect?: (testCase: TestCaseWithDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

#### 状態管理

```typescript
type MentionState =
  | { type: 'idle' }
  | { type: 'suite-search'; query: string; startIndex: number }
  | { type: 'case-search'; suiteId: string; suiteName: string; query: string; startIndex: number };
```

#### 状態フロー

```
idle ──[@入力]──> suite-search ──[スイート選択+/]──> case-search ──[ケース選択]──> idle
  ^                    │                                │
  └────[ESC/削除]──────┴────────────[ESC/削除]──────────┘
```

#### キーボード操作

| キー | suite-search | case-search |
|------|--------------|-------------|
| `↑/↓` | 候補選択 | 候補選択 |
| `Enter/Tab` | スイート確定 | ケース選択＆コピー |
| `Escape` | idle に戻る | suite-search に戻る |
| `Backspace` | クエリ削除、空なら@削除 | クエリ削除、空なら/削除 |

#### サブコンポーネント

```
MentionInput
├── <input> (テキスト入力)
└── SuggestionDropdown（条件付き表示）
    ├── ヘッダー（「テストスイート」or「テストケース」）
    ├── リスト項目 x N（名前/タイトル、説明、ステータスバッジ）
    ├── ローディング表示
    └── 「結果なし」表示
```

#### 参考パターン

- `CommandPalette.tsx:116-147` - キーボードナビゲーション
- `CommandPalette.tsx:194-223` - リストUI、aria属性

---

### Step 3: CreateTestCaseModal改修

**修正:** `apps/web/src/pages/TestSuiteDetail.tsx`（380-499行目）

#### 変更内容

1. **projectId取得追加:**
   ```typescript
   const { data: suiteData } = useQuery({
     queryKey: ['test-suite', testSuiteId],
     queryFn: () => testSuitesApi.getById(testSuiteId),
   });
   const projectId = suiteData?.testSuite?.projectId;
   ```

2. **状態追加:**
   ```typescript
   const [preconditions, setPreconditions] = useState<string[]>([]);
   const [steps, setSteps] = useState<string[]>([]);
   const [expectedResults, setExpectedResults] = useState<string[]>([]);
   ```

3. **inputをMentionInputに置き換え:**
   ```typescript
   <MentionInput
     value={title}
     onChange={setTitle}
     projectId={projectId!}
     onTestCaseSelect={handleTestCaseSelect}
     placeholder="例: ログインフォームの表示確認（@でテストケース参照）"
     disabled={!projectId}
   />
   ```

4. **テストケース選択ハンドラ:**
   ```typescript
   const handleTestCaseSelect = (testCase: TestCaseWithDetails) => {
     // タイトルを選択したケースのタイトルにセット
     setTitle(testCase.title);
     setDescription(testCase.description || '');
     setPriority(testCase.priority);
     setPreconditions(testCase.preconditions.map(p => p.content));
     setSteps(testCase.steps.map(s => s.content));
     setExpectedResults(testCase.expectedResults.map(e => e.content));
     toast.info(`「${testCase.title}」の内容をコピーしました`);
   };
   ```

5. **コピー内容プレビュー表示:**
   - 前提条件・ステップ・期待結果がある場合、フォーム下部に折りたたみセクションで表示
   - 「コピーされた内容」セクション（Disclosure/Accordionパターン）
   - 各項目をリスト形式で表示（編集不可、プレビューのみ）

6. **フォーム送信更新:**
   - コピーされた前提条件・ステップ・期待結果を含めてAPI呼び出し

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/hooks/useDebounce.ts` | **新規作成** - デバウンスフック |
| `apps/web/src/components/common/MentionInput.tsx` | **新規作成** - @参照入力コンポーネント |
| `apps/web/src/pages/TestSuiteDetail.tsx` | **改修** - CreateTestCaseModalにMentionInput統合 |

---

## 技術的考慮事項

### デバウンス
- 300msのデバウンスでAPI呼び出しを最適化
- `useDebounce`フックでクエリ文字列をラップ

### ドロップダウン位置
- 入力フィールド直下に表示
- 画面下端でオーバーフローする場合は上部に表示

### アクセシビリティ
- `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`
- `role="listbox"`, `role="option"`, `aria-selected`
- スクリーンリーダー用`aria-live`リージョン

### エッジケース対応
- @の前に文字がある場合も正常動作
- 複数@は最後の@のみ参照モード
- ネットワークエラー時のエラー表示
- フォーカス喪失時はドロップダウン閉じ（状態維持）

---

## UI仕様

### ドロップダウンスタイル
```
bg-background-secondary
border border-border
rounded-lg shadow-lg
max-h-64 overflow-y-auto
z-dropdown (10)
```

### 選択アイテムスタイル
```
選択中: bg-accent-subtle text-foreground
非選択: hover:bg-background-tertiary text-foreground-muted
```

### ステータスバッジ
- ACTIVE: badge-success
- DRAFT: badge-warning
- ARCHIVED: text-foreground-muted

### コピー内容プレビューUI

```
┌─────────────────────────────────────────┐
│ ▼ コピーされた内容（クリックで展開）      │
├─────────────────────────────────────────┤
│ 前提条件 (2件)                           │
│  1. ユーザーが登録済みであること          │
│  2. ログインページにアクセス可能          │
│                                         │
│ ステップ (3件)                           │
│  1. ログインページを開く                  │
│  2. メールアドレスを入力                  │
│  3. パスワードを入力してログインをクリック  │
│                                         │
│ 期待結果 (1件)                           │
│  1. ダッシュボードが表示される            │
└─────────────────────────────────────────┘
```

- 初期状態: 折りたたみ
- ChevronDown/ChevronUpアイコンで開閉表示
- 各セクションはテキスト表示のみ（編集不可）
- 項目がない場合はそのセクションを非表示
