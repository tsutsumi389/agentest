# PiPパネル ナビゲーション不具合修正プラン

## 問題
期待結果が複数ある場合に、期待結果1でステータスを変更すると、期待結果2をスキップして次のテストケースに移動してしまう。

## 原因
`PipExecutionPanel.tsx`の`goToNextOrNextTestCase`関数で、`currentIndex`を直接参照しているが、ReactのuseCallbackクロージャにより古い値を参照している。

```typescript
// 問題のコード（329-339行目）
const goToNextOrNextTestCase = useCallback(() => {
  if (currentIndex < totalItems - 1) {
    setCurrentIndex(currentIndex + 1);  // ← 古いcurrentIndexを参照している可能性
  } else if (...) {
    ...
  }
}, [currentIndex, totalItems, ...]);
```

ステータス変更は遅延実行（150ms後）されるため、その間にReactの状態が更新されても、クロージャ内の`currentIndex`は古い値のまま。

## 修正方法
`setCurrentIndex`を関数形式で呼び出し、常に最新の値を使用するように変更する。

## 修正ファイル

### `apps/web/src/components/execution/PipExecutionPanel.tsx`

**変更箇所1: goToNextOrNextTestCase関数（329-339行目）**

```typescript
// 修正前
const goToNextOrNextTestCase = useCallback(() => {
  if (currentIndex < totalItems - 1) {
    setCurrentIndex(currentIndex + 1);
  } else if (currentTestCaseIndex < totalTestCases - 1) {
    setCurrentIndex(0);
    onNavigateToTestCase('next');
  }
}, [currentIndex, totalItems, currentTestCaseIndex, totalTestCases, onNavigateToTestCase]);

// 修正後
const goToNextOrNextTestCase = useCallback(() => {
  setCurrentIndex((prevIndex) => {
    if (prevIndex < totalItems - 1) {
      // まだ次のアイテムがある
      return prevIndex + 1;
    } else if (currentTestCaseIndex < totalTestCases - 1) {
      // 最後のアイテムで、次のテストケースがある場合
      onNavigateToTestCase('next');
      return 0;
    }
    return prevIndex;
  });
}, [totalItems, currentTestCaseIndex, totalTestCases, onNavigateToTestCase]);
```

## 検証方法
1. テスト実行画面でPiPウィンドウを開く
2. 期待結果が2つ以上あるテストケースを選択
3. 期待結果1のステータスを変更
4. 期待結果2に遷移することを確認（次のテストケースにスキップしないこと）
5. 期待結果2のステータスを変更
6. 次のテストケースに遷移することを確認
