# テストスイートページの「プロジェクトへ戻る」リンク削除

## 概要
テストスイートページのヘッダーにある「プロジェクトへ戻る」リンクを削除する。
ヘッダーのプロジェクト名からプロジェクトへ戻れるようになったため、重複するナビゲーションを削除する。

## 対象ファイル
- `apps/web/src/components/test-suite/TestSuiteHeader.tsx`

## 変更内容

### 1. 戻るボタンの削除（140〜147行目）
以下のコードを削除：
```tsx
{/* 戻るボタン */}
<Link
  to={`/projects/${testSuite.projectId}`}
  className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground transition-colors"
  aria-label={`${project?.name || 'プロジェクト'}に戻る`}
>
  <ChevronLeft className="w-4 h-4" />
  {project?.name || 'プロジェクト'}
</Link>
```

### 2. 不要なインポートの削除（2行目）
`ChevronLeft`はテストスイート表示時のみ使用しているため、インポートから削除：
```tsx
// 変更前
import { Play, Pencil, ChevronLeft, ChevronRight, FileText, History, MessageSquare, Settings, Copy, X } from 'lucide-react';

// 変更後
import { Play, Pencil, ChevronRight, FileText, History, MessageSquare, Settings, Copy, X } from 'lucide-react';
```

## 影響範囲
- テストスイート表示時のヘッダーレイアウトが変更される
- テストケース選択時のパンくずリスト（プロジェクト → テストスイート → テストケース）は変更なし

## 検証方法
1. `docker compose exec dev pnpm build` でビルドエラーがないことを確認
2. `docker compose exec dev pnpm lint` でlintエラーがないことを確認
3. テストスイートページにアクセスし、テストスイート名のみ表示されることを確認
4. ヘッダーのプロジェクト名からプロジェクトに戻れることを確認
