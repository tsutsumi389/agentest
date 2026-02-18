# 未使用 LineChart コンポーネントの削除

## Context

OSS移行プラン (2-2. 管理画面の簡素化) の残存クリーンアップ。メトリクスページ削除後に未使用となった `LineChart` コンポーネントを削除する。

## 変更内容

### 削除ファイル
- `apps/admin/src/components/ui/LineChart.tsx`

### 確認済み
- コードベース内のどこからも import されていない
- メトリクスページで使用されていた名残

## 検証

- `pnpm build` が通ること
- `pnpm test` が通ること
