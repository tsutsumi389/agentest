# PiPテストケース遷移時のインデックスリセットバグ修正

## 問題
テストケース1の期待結果（最後のアイテム）でステータスをクリックしてテストケース2へ遷移した際、テストケース2の前提条件（最初のアイテム）ではなく期待結果が表示される。

## 原因分析
`goToNextOrNextTestCase`関数で`onNavigateToTestCase('next')`を呼んだ後、`currentIndex`のリセットは`useEffect`で行われる：

```typescript
useEffect(() => {
  setCurrentIndex(0);
}, [testCaseId]);
```

しかし、Reactの更新サイクルでは：
1. `onNavigateToTestCase('next')`が呼ばれる
2. 親で`selectedTestCaseId`が更新される
3. PipExecutionPanelに新しいpropsが渡される
4. `navigableItems`が新しいテストケースのデータで再計算される
5. **この時点で`currentIndex`はまだ古い値（例：4）のまま**
6. `navigableItems[4]`が表示される（期待結果）
7. `useEffect`が実行され`setCurrentIndex(0)`
8. 再レンダリングで正しいアイテムが表示される

ステップ5-6で古いインデックスが使われるため、一瞬（または永続的に）期待結果が表示される。

## 対象ファイル
- `apps/web/src/components/execution/PipExecutionPanel.tsx`

## 修正内容
`goToNextOrNextTestCase`で次のテストケースに遷移する**前**に`currentIndex`を0にリセットする：

```typescript
const goToNextOrNextTestCase = useCallback(() => {
  if (currentIndex < totalItems - 1) {
    setCurrentIndex(currentIndex + 1);
  } else if (currentTestCaseIndex < totalTestCases - 1) {
    setCurrentIndex(0);  // ← 追加：次のテストケースに移動する前にリセット
    onNavigateToTestCase('next');
  }
}, [currentIndex, totalItems, currentTestCaseIndex, totalTestCases, onNavigateToTestCase]);
```

## 検証方法
1. PiPウィンドウを開く
2. テストケース1の最後のアイテム（期待結果）に移動
3. ステータスをクリック
4. テストケース2の最初のアイテム（前提条件）が表示されることを確認
