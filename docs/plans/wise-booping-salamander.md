# ヘッダー仕様変更計画

## 概要

現在のヘッダー「[A]Agentest」を以下のように変更する：

- **[A]ロゴ** → ダッシュボード（`/dashboard`）へ遷移
- **テキスト部分** → プロジェクト内ならプロジェクト名（プロジェクトへのリンク）、それ以外なら「Agentest」

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/hooks/useCurrentProject.ts` | **新規作成**: 現在のプロジェクトを取得するフック |
| `apps/web/src/components/layout-parts/Header.tsx` | ロゴとテキストを分離、HeaderTitleコンポーネント追加 |

## 実装詳細

### 1. `useCurrentProject`フック（新規作成）

URLパラメータとReact Queryキャッシュからプロジェクト情報を取得する。

**対象ルートとプロジェクト判定：**

| ルート | 判定方法 |
|--------|---------|
| `/projects/:projectId` | URLから直接取得 |
| `/projects/:projectId/settings` | URLから直接取得 |
| `/test-suites/:testSuiteId` | キャッシュから`testSuite.projectId`を取得 |
| `/executions/:executionId` | キャッシュから`execution.testSuite.projectId`を取得 |
| その他 | プロジェクト外（`null`） |

```typescript
// hooks/useCurrentProject.ts
export function useCurrentProject(): {
  project: { id: string; name: string } | null;
  isLoading: boolean;
}
```

### 2. Header.tsx の変更

**Before:**
```tsx
<Link to="/dashboard" className="flex items-center gap-2">
  <AgentestLogo className="w-6 h-6 text-accent" />
  <span className="font-semibold text-foreground hidden sm:block">
    Agentest
  </span>
</Link>
```

**After:**
```tsx
<div className="flex items-center gap-2">
  {/* ロゴ: 常にダッシュボードへ */}
  <Link to="/dashboard">
    <AgentestLogo className="w-6 h-6 text-accent hover:text-accent-hover" />
  </Link>

  {/* テキスト: プロジェクト内ならプロジェクト名、それ以外はAgentest */}
  <HeaderTitle />
</div>
```

**HeaderTitleコンポーネント:**
- プロジェクト内 → プロジェクト名を表示、`/projects/:projectId`へリンク
- プロジェクト外 → 「Agentest」を表示、`/dashboard`へリンク

## 実装ステップ

1. `useCurrentProject`フックを作成
2. Header.tsxにHeaderTitleコンポーネントを追加
3. ロゴとテキストのリンクを分離
4. 動作確認

## 検証方法

以下のページで動作確認：

1. `/dashboard` → 「Agentest」表示、ロゴクリックでダッシュボード維持
2. `/projects` → 「Agentest」表示
3. `/projects/:projectId` → プロジェクト名表示、クリックでプロジェクト詳細へ
4. `/test-suites/:testSuiteId` → プロジェクト名表示
5. `/executions/:executionId` → プロジェクト名表示
6. ロゴクリック → 全ページでダッシュボードへ遷移
