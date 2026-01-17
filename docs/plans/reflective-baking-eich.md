# プロジェクト画面 タブ形式UI修正計画

## 概要

プロジェクト詳細画面（ProjectDetail.tsx）をタブ形式に変更し、「概要」「テストスイート」「設定」の3タブで構成する。

## 現状

- **ProjectDetail.tsx** (`/projects/:projectId`) - テストスイート一覧を表示
- **ProjectSettings.tsx** (`/projects/:projectId/settings`) - タブ形式で設定を表示（別ページ）
- タブUIパターンは TestSuiteHeader.tsx に実装済み（`border-b-2`スタイル）

## 実装方針

- タブ状態はURLクエリパラメータで管理（`?tab=overview`）
- 既存の設定ルート（`/projects/:projectId/settings`）はリダイレクト設置
- タブUIはTestSuiteHeader.tsxと同じスタイルパターンを使用

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/pages/ProjectDetail.tsx` | タブUI追加、設定コンテンツ統合 |
| `apps/web/src/pages/ProjectSettings.tsx` | リダイレクト専用に変更 |
| `apps/web/src/components/project/ProjectOverviewTab.tsx` | **新規作成** - 概要タブ（サンプル） |
| `apps/web/src/components/project/ProjectSettingsTab.tsx` | **新規作成** - 設定タブコンテンツ |

---

## 実装手順

### 1. ProjectOverviewTab.tsx 新規作成

概要タブのサンプルコンポーネント（別タスクで本実装予定）

```tsx
// apps/web/src/components/project/ProjectOverviewTab.tsx
interface ProjectOverviewTabProps {
  projectId: string;
}

export function ProjectOverviewTab({ projectId }: ProjectOverviewTabProps) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">テスト状況</h2>
      <p className="text-foreground-muted">
        プロジェクトのテスト状況がここに表示されます。
      </p>
      {/* サンプル: 後で実装 */}
    </div>
  );
}
```

### 2. ProjectSettingsTab.tsx 新規作成

ProjectSettings.tsxの設定コンテンツを抽出

```tsx
// apps/web/src/components/project/ProjectSettingsTab.tsx
interface ProjectSettingsTabProps {
  project: Project;
  currentRole?: 'OWNER' | ProjectMemberRole;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onProjectUpdated: (project: Project) => void;
}
```

内容：
- 左サイドナビゲーション（一般、メンバー、環境、履歴、危険な操作）
- 各セクションのコンテンツ表示
- ProjectSettings.tsxの210-266行目のレイアウトを移植

### 3. ProjectDetail.tsx 変更

**3-1. インポート追加**
```tsx
import { useSearchParams } from 'react-router';
import { BarChart3 } from 'lucide-react';
import { ProjectOverviewTab } from '../components/project/ProjectOverviewTab';
import { ProjectSettingsTab } from '../components/project/ProjectSettingsTab';
```

**3-2. タブ型定義追加**
```tsx
type ProjectTab = 'overview' | 'suites' | 'settings';
type SettingsSection = 'general' | 'members' | 'environments' | 'history' | 'danger';
```

**3-3. タブ状態管理（useSearchParams）**
- `?tab=overview` でタブ状態をURL管理
- `?tab=settings&section=members` で設定内セクションも管理

**3-4. UIレイアウト変更**
- ヘッダー下部にタブナビゲーション追加
- 設定ボタン削除（タブに統合）
- タブコンテンツの条件分岐表示

### 4. ProjectSettings.tsx 変更

リダイレクト専用に変更：

```tsx
export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'general';
  return <Navigate to={`/projects/${projectId}?tab=settings&section=${tab}`} replace />;
}
```

---

## タブUI仕様

```tsx
const TABS = [
  { id: 'overview', label: '概要', icon: BarChart3 },
  { id: 'suites', label: 'テストスイート', icon: FileText },
  { id: 'settings', label: '設定', icon: Settings }, // OWNER/ADMINのみ表示
];
```

**スタイル（TestSuiteHeader.tsxと同じパターン）:**
```tsx
<nav className="-mb-px flex gap-4" aria-label="タブ">
  <button
    className={`
      flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors
      ${isActive
        ? 'border-accent text-accent'
        : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
      }
    `}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
</nav>
```

---

## 権限チェック

- **概要・テストスイートタブ**: 全メンバーアクセス可
- **設定タブ**: OWNER/ADMINのみ表示
- URLで直接`?tab=settings`にアクセスした場合、権限がなければ概要タブにリダイレクト

---

## 検証方法

1. `/projects/:projectId` アクセス → 概要タブ表示
2. タブクリック → URL変更、コンテンツ切り替え
3. `/projects/:projectId/settings` アクセス → `?tab=settings` にリダイレクト
4. 権限なしユーザー → 設定タブ非表示
5. ブラウザの戻る/進む → タブ状態が正しく復元
