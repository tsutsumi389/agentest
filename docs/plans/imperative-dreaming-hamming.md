# 自動PiP化実装計画

## 概要
ブラウザタブがバックグラウンドになった時に自動でPiP（Picture-in-Picture）を開き、フォアグラウンドに戻った時に閉じる機能を実装する。手動のPiPボタンは削除する。

## 変更ファイル

### 1. `/apps/web/src/pages/Execution.tsx`
- `usePageVisibility`フックをインポート
- 自動PiPロジックを`useEffect`で実装
- ユーザーが手動でPiPを閉じた場合の追跡用`useRef`を追加
- `ExecutionTestCaseDetailPanel`へのPiP関連props（`isPipSupported`, `isPipActive`, `onOpenPip`）を削除

**追加するロジック:**
```typescript
const { isHidden } = usePageVisibility();
const userClosedPipRef = useRef(false);

// onCloseコールバックでユーザー手動閉じを検知
const { pipWindow, isPipSupported, isPipActive, openPip, closePip } = usePictureInPicture({
  width: 450,
  height: 400,
  onClose: () => {
    if (document.visibilityState === 'hidden') {
      userClosedPipRef.current = true;
    }
  },
});

useEffect(() => {
  if (!isPipSupported || !selectedTestCaseId) return;

  if (isHidden) {
    // バックグラウンドになったら自動でPiPを開く（ユーザーが閉じた場合は除く）
    if (!userClosedPipRef.current && !isPipActive) {
      openPip();
    }
  } else {
    // フォアグラウンドに戻ったらPiPを閉じる
    if (isPipActive) {
      closePip();
    }
    userClosedPipRef.current = false;
  }
}, [isHidden, isPipSupported, isPipActive, selectedTestCaseId, openPip, closePip]);
```

### 2. `/apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx`
- PiPボタン（166-178行目）を削除
- props型定義から削除: `isPipSupported?`, `isPipActive?`, `onOpenPip?`
- `PictureInPicture2`アイコンのインポートを削除

## 動作仕様

| 状態 | 動作 |
|------|------|
| タブがバックグラウンドになった | 自動でPiPウィンドウを開く |
| タブがフォアグラウンドに戻った | PiPウィンドウを自動で閉じる |
| ユーザーがPiPを手動で閉じた | そのセッション中は自動で開かない |
| タブがフォアグラウンドに戻った後 | 再度バックグラウンドになったら自動で開く |
| テストケース未選択 | PiPを開かない |
| PiP非対応ブラウザ | 何もしない |

## 検証方法
1. Executionページでテストケースを選択
2. 別のタブに切り替えてバックグラウンドにする → PiPが自動で開く
3. 元のタブに戻る → PiPが自動で閉じる
4. PiPウィンドウを手動で閉じる → 再度バックグラウンドにしてもPiPが開かない
5. 元のタブに戻り、再度バックグラウンドにする → PiPが開く
