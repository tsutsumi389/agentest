# テストスイート別カバレッジ実装計画

## 概要

プロジェクト概要タブにテストスイート別カバレッジを表示する `SuiteCoverageList` コンポーネントを実装する。

**現状**: バックエンドの `getSuiteCoverage()` は実装済み。フロントエンドコンポーネントのみ未実装。

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/project/dashboard/SuiteCoverageList.tsx` | **新規作成** |
| `apps/web/src/components/project/dashboard/index.ts` | エクスポート追加 |
| `apps/web/src/components/project/ProjectOverviewTab.tsx` | インポート・統合 |

---

## 実装詳細

### 1. SuiteCoverageList.tsx（新規作成）

**表示内容:**
- 各テストスイートのカバレッジ状況をリスト表示
- スイート名、テストケース数、実行済み数、成功率、最終実行日時
- `SimpleProgressBar` で成功率を可視化
- 行クリックでテストスイート詳細へ遷移

**成功率の色分け:**
- 80%以上: `success`（緑）
- 50-80%: `warning`（黄）
- 50%未満: `danger`（赤）

**UIパターン:**
- `AttentionRequiredTable.tsx` のリストアイテムパターンを踏襲
- カードレイアウト（`card p-6`）
- ホバーエフェクト + ChevronRight矢印
- 空状態メッセージ対応

**使用する型:**
```typescript
interface SuiteCoverageItem {
  testSuiteId: string;
  name: string;
  testCaseCount: number;
  executedCount: number;
  passRate: number;        // 0-100
  lastExecutedAt: Date | string | null;
}
```

### 2. index.ts 修正

```typescript
export { SuiteCoverageList } from './SuiteCoverageList';
```

### 3. ProjectOverviewTab.tsx 修正

- `SuiteCoverageList` をインポートに追加
- 59行目のコメントアウトを解除

---

## 実装順序

1. `SuiteCoverageList.tsx` 新規作成
2. `index.ts` にエクスポート追加
3. `ProjectOverviewTab.tsx` を修正して統合

---

## 検証方法

1. **開発サーバー起動**: `docker compose exec dev pnpm dev`
2. **手動確認**:
   - プロジェクト詳細 → 概要タブを開く
   - テストスイート別カバレッジセクションが表示される
   - 各行をクリックしてスイート詳細へ遷移できる
   - ホバーエフェクト、進捗バーの色分けが正しい
3. **空状態確認**: テストスイートがないプロジェクトで空メッセージが表示される
4. **型チェック**: `docker compose exec dev pnpm build`
