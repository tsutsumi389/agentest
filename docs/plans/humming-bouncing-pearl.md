# 実行結果の分布と最近の活動のバランス調整

## 目的
プロジェクト概要タブの「実行結果の分布」と「最近の活動」セクションの高さを揃え、見た目のバランスを整える。

## 現状の問題
- 「最近の活動」は `max-h-[372px]` で高さ制限されている
- 「実行結果の分布」は固定高さがなく、内容に応じて高さが変わる
- グリッドレイアウトで横並びにしているが、視覚的なバランスが悪い

## 変更対象ファイル
1. `apps/web/src/components/project/dashboard/ResultDistributionChart.tsx`
2. `apps/web/src/components/project/dashboard/RecentActivityTimeline.tsx`

## 実装方針

### 両セクションに同じ最小高さを設定

**ResultDistributionChart.tsx（行81）**:
```tsx
// 変更前
<div className={`bg-background-secondary border border-border rounded-lg p-4 flex flex-col ${className ?? ''}`}>

// 変更後
<div className={`bg-background-secondary border border-border rounded-lg p-4 flex flex-col min-h-[420px] ${className ?? ''}`}>
```

**RecentActivityTimeline.tsx（行74）**:
```tsx
// 変更前
<div className={`card p-6 flex flex-col ${className ?? ''}`}>

// 変更後
<div className={`card p-6 flex flex-col min-h-[420px] ${className ?? ''}`}>
```

**計算根拠**:
- ヘッダー + パディング: 約48px
- アクティビティリスト: 372px
- 合計: 約420px

## 検証方法
1. 開発サーバーでプロジェクト概要タブを確認
2. 両セクションの高さが揃っていることを確認
3. 「最近の活動」が5アイテム以上の場合、スクロールが機能することを確認
