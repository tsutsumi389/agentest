# 実行結果の分布 - 円グラフと凡例のバランス改善

## 問題
- 円グラフ(160px)が小さく、min-h-[420px]のコンテナに対して余白が目立つ
- 凡例が`flex-1`で幅を取りすぎ、円グラフとのバランスが悪い

## 変更対象
`apps/web/src/components/project/dashboard/ResultDistributionChart.tsx`

## 変更内容

### 1. 円グラフサイズ拡大
```tsx
// Before
size={160}

// After
size={200}
```

### 2. レイアウト調整
```tsx
// Before
<div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6">
  ...
  <div className="flex-1 w-full space-y-2">

// After
<div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8">
  ...
  <div className="w-full md:w-auto md:min-w-[180px] space-y-3">
```

| 項目 | Before | After |
|------|--------|-------|
| 円グラフ | 160px | 200px |
| gap | gap-6 | gap-8 |
| 凡例幅 | flex-1 w-full | w-full md:w-auto md:min-w-[180px] |
| 凡例行間 | space-y-2 | space-y-3 |

## 検証方法
1. 開発サーバーでプロジェクト概要タブを確認
2. 円グラフと凡例のバランスが改善されていることを確認
3. レスポンシブ（md未満で縦並び）が機能することを確認
