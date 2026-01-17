# 最近の活動（タイムライン）実装計画

## 概要
プロジェクト概要タブに最近の活動をタイムライン形式で表示するコンポーネントを実装する。

**重要**: バックエンド（API・型定義）は既に実装済み。フロントエンドコンポーネントのみ作成が必要。

---

## 変更対象ファイル

### 新規作成
- `apps/web/src/components/project/dashboard/RecentActivityTimeline.tsx`

### 変更
- `apps/web/src/components/project/dashboard/index.ts` - エクスポート追加
- `apps/web/src/components/project/ProjectOverviewTab.tsx` - コメントアウト解除

---

## 実装詳細

### 1. RecentActivityTimeline.tsx

#### 活動タイプ別設定
| type | アイコン | 色 | リンク先 |
|------|---------|-----|----------|
| `execution` | `Play` | success（緑） | `/executions/{id}` |
| `testCaseUpdate` | `Pencil` | accent（青） | `/projects/{projectId}/test-suites/{testSuiteId}/test-cases/{testCaseId}` |
| `review` | `MessageSquare` | warning（黄） | `/test-suites/{testSuiteId}?tab=reviews` |

#### コンポーネント構造
```
RecentActivityTimeline
├── ヘッダー: "最近の活動"
├── ActivityItem[] (各活動アイテム)
│   ├── アイコン（タイプ別の色付き丸形背景）
│   ├── コンテンツ
│   │   ├── description（活動内容）
│   │   ├── アクター情報（アバター + 名前）
│   │   └── 相対時間表示（title属性で完全日時）
│   └── ChevronRight（hover時表示）
└── EmptyState（活動がない場合）
```

#### スタイリング（AttentionRequiredTableパターン準拠）
```tsx
// リストアイテム
className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors group"

// アイコンコンテナ
className="flex-shrink-0 w-8 h-8 rounded-full ${bgColor} flex items-center justify-center"
```

#### 依存関係
- `react-router`: Link, useParams
- `lucide-react`: Play, Pencil, MessageSquare, ChevronRight, History
- `@agentest/shared`: ProjectDashboardStats, RecentActivityItem, RecentActivityType
- `../../../lib/date`: formatRelativeTimeOrDefault, formatDateTime

### 2. dashboard/index.ts 変更
```typescript
export { RecentActivityTimeline } from './RecentActivityTimeline';
```

### 3. ProjectOverviewTab.tsx 変更
L56のコメントアウトを解除:
```tsx
<RecentActivityTimeline stats={stats} />
```

---

## 実装順序

1. `RecentActivityTimeline.tsx` を作成
2. `dashboard/index.ts` にエクスポート追加
3. `ProjectOverviewTab.tsx` でコンポーネント有効化

---

## 検証方法

1. **開発サーバー起動**
   ```bash
   cd docker && docker compose up
   ```

2. **手動テスト**
   - プロジェクト詳細画面（`/projects/{projectId}`）の概要タブを開く
   - 「最近の活動」セクションが表示されることを確認
   - 各活動アイテムをクリックし、正しいページに遷移することを確認
   - 活動がない場合、空状態が表示されることを確認

3. **ビルド確認**
   ```bash
   docker compose exec dev pnpm build
   ```
