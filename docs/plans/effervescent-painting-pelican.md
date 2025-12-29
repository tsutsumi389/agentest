# Step 10: TestSuiteDetail.tsx 改修 - 詳細実装計画

## 概要

TestSuiteDetail.tsxのStep 10改修は**ほぼ完了**しており、残りは**URLクエリパラメータとの同期**のみ。

## 現在の実装状況

| 要件 | 状況 | 備考 |
|-----|------|------|
| `usePageSidebar()` でサイドバーをセット | ✅完了 | L44, L110-127 |
| 2カラムレイアウト | ✅完了 | Layout.tsxで実装済み |
| テストケース選択時に詳細パネル表示 | ✅完了 | L219-235 |
| テストケース未選択時に概要表示 | ✅完了 | L237-260 |
| タブシステム維持 | ✅完了 | L49-53 |
| **URLクエリパラメータ `?testCase=xxx`** | ❌未実装 | useStateで管理中 |

## 必要な変更

### 変更ファイル
- `apps/web/src/pages/TestSuiteDetail.tsx`

### 変更内容

#### 1. selectedTestCaseIdをURLから取得するように変更

**現在の実装 (L46):**
```typescript
const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
```

**変更後:**
```typescript
// URLクエリパラメータから選択状態を取得
const selectedTestCaseId = searchParams.get('testCase');
```

#### 2. テストケース選択ハンドラをURL更新に変更

**新規追加:**
```typescript
// テストケース選択ハンドラ（URLを更新）
const handleSelectTestCase = useCallback((testCaseId: string | null) => {
  const newParams = new URLSearchParams(searchParams);
  if (testCaseId) {
    newParams.set('testCase', testCaseId);
  } else {
    newParams.delete('testCase');
  }
  setSearchParams(newParams);
}, [searchParams, setSearchParams]);
```

#### 3. タブ変更時にtestCaseパラメータを保持

**現在の実装 (L52-54):**
```typescript
const handleTabChange = (tab: TabType) => {
  setSearchParams({ tab });
};
```

**変更後:**
```typescript
const handleTabChange = (tab: TabType) => {
  const newParams = new URLSearchParams(searchParams);
  newParams.set('tab', tab);
  setSearchParams(newParams);
};
```

#### 4. サイドバーのonSelectプロップを更新

**現在 (L118):**
```typescript
onSelect={setSelectedTestCaseId}
```

**変更後:**
```typescript
onSelect={handleSelectTestCase}
```

#### 5. 詳細パネルのonCloseを更新

**現在 (L226):**
```typescript
onClose={() => setSelectedTestCaseId(null)}
```

**変更後:**
```typescript
onClose={() => handleSelectTestCase(null)}
```

#### 6. 削除後の処理を更新

**現在 (L230-233):**
```typescript
onDeleted={() => {
  setSelectedTestCaseId(null);
  queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
}}
```

**変更後:**
```typescript
onDeleted={() => {
  handleSelectTestCase(null);
  queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
}}
```

## 変更による効果

1. **URL永続性**: `?testCase=xxx` でテストケース選択状態がURLに反映
2. **ブラウザ履歴対応**: 戻る/進むボタンで選択状態が復元
3. **ページリロード対応**: リロード後も選択状態を維持
4. **共有可能URL**: 特定のテストケースを直接開けるURLを共有可能

## 実装手順

1. `selectedTestCaseId`をURLパラメータから取得するように変更
2. `handleSelectTestCase`関数を追加
3. `handleTabChange`を修正してtestCaseパラメータを保持
4. 各コールバックを更新
5. 動作確認

## テスト項目

- [ ] テストケースをクリック → URLに`?testCase=xxx`が追加される
- [ ] ブラウザの戻るボタン → 前の選択状態に戻る
- [ ] ページリロード → 選択状態が維持される
- [ ] タブを切り替え → testCaseパラメータが保持される
- [ ] 詳細パネルを閉じる → URLからtestCaseが削除される
- [ ] テストケース削除 → URLからtestCaseが削除される
