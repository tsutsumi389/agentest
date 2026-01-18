# 実行履歴概要画面の改善計画

## 概要
実行履歴の概要画面（ExecutionOverviewPanel）に対して3つの改善を行う。

## 変更内容

### 1. スキップアイコンの統一
**問題**: スキップのアイコンが不統一
- `ExecutionOverviewPanel.tsx:154` → `Ban`アイコン
- `ExecutionOverviewPanel.tsx:328` → `MinusCircle`アイコン
- `execution-status.ts` → `MinusCircle`アイコン
- デザインガイドライン推奨 → `SkipForward`アイコン

**対応**: アイコンを`SkipForward`に統一（色は現在の`warning`を維持）
| ファイル | 変更箇所 |
|---------|---------|
| `apps/web/src/lib/execution-status.ts` | SKIPPED設定のアイコンを`SkipForward`に変更 |
| `apps/web/src/components/execution/ExecutionOverviewPanel.tsx` | `Ban`→`SkipForward`、`MinusCircle`→`SkipForward`に変更 |

### 2. PiPボタンの追加
**変更内容**:
- ヘッダー部分にPiPボタンを追加（テストケース詳細パネルと同じパターン）
- `ExecutionOverviewPanel.tsx`にprops追加（`isPipSupported`, `isPipActive`, `onOpenPip`）
- `Execution.tsx`からpropsを渡す

**配置**: ヘッダーのタイトル右側

### 3. UI/UXの改善
**問題**: 期待結果のその他ステータスが3列グリッドに2項目のみで不均衡

**対応**:
- 3列グリッドを2列に変更（スキップと未実行のみなので）

## 変更ファイル一覧

1. **`apps/web/src/lib/execution-status.ts`**
   - `stepResultStatusConfig.SKIPPED`: アイコンを`SkipForward`に変更
   - `expectedResultStatusConfig.SKIPPED`: アイコンを`SkipForward`に変更

2. **`apps/web/src/components/execution/ExecutionOverviewPanel.tsx`**
   - import: `Ban`削除、`SkipForward`, `PictureInPicture2`追加
   - props: `isPipSupported`, `isPipActive`, `onOpenPip`追加
   - 154行目: `Ban`→`SkipForward`に変更
   - 148行目: `grid-cols-3`→`grid-cols-2`に変更
   - 246行目付近: PiPボタン追加
   - 328行目: `MinusCircle`→`SkipForward`に変更

3. **`apps/web/src/pages/Execution.tsx`**
   - `ExecutionOverviewPanel`へPiP関連propsを渡す

## 検証方法
1. `docker compose exec dev pnpm build` でビルドエラーがないことを確認
2. ブラウザで実行履歴画面を開き、以下を確認:
   - スキップアイコンが`SkipForward`（→|のような形）になっている
   - PiPボタンがヘッダーに表示されている
   - その他ステータスが2列で均等に表示されている
