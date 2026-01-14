# PiPウィンドウのサイズ設定修正プラン

## 概要
テスト実行のPicture-in-Pictureウィンドウのサイズを450x650に固定し、毎回初期サイズで開くように修正する。

## 要件
1. PiPウィンドウの初期サイズを450x650にする
2. ウィンドウを開くたびに初期サイズで開く（前回のウィンドウサイズを記憶しない）

## 修正ファイル

### 1. `apps/web/src/pages/Execution.tsx`
- 32-35行目のサイズ設定を変更
- `height: 600` → `height: 650`

```typescript
const { pipWindow, isPipSupported, isPipActive, openPip, closePip } = usePictureInPicture({
  width: 450,
  height: 650,  // 600から650に変更
});
```

### 2. `apps/web/src/hooks/usePictureInPicture.ts`
- PiPウィンドウを開いた直後に`resizeTo()`を呼び出して強制的に初期サイズにリサイズ
- ブラウザが記憶した前回サイズを上書きする

```typescript
// openPip関数内、setPipWindow(newPipWindow)の前に追加
// 明示的にサイズを設定（ブラウザが前回サイズを記憶している場合に対応）
newPipWindow.resizeTo(width, height);
```

## 検証方法
1. `docker compose exec dev pnpm dev` で開発サーバーを起動
2. テスト実行画面でPiPウィンドウを開く
3. サイズが450x650で開くことを確認
4. PiPウィンドウをリサイズして閉じる
5. 再度PiPウィンドウを開き、初期サイズ（450x650）で開くことを確認
