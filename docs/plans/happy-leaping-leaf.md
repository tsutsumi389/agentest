# ダッシュボード画面改善プラン

## 現状の課題

現在のダッシュボード画面には以下の未実装・改善点があります：

1. **統計カード**: 成功/失敗数が "-" のプレースホルダー状態
2. **最近の実行**: "最近の実行はありません" の固定表示
3. **サイドバーサマリー**: "今週のテスト: 0回", "最終実行: -" の固定値
4. **データ取得API**: ダッシュボード用の統計APIが存在しない

## 改善プラン

### Phase 1: 未実装機能の完成 [優先度: 高]

#### 1.1 ダッシュボード統計API（新規）

**エンドポイント**: `GET /api/users/:userId/dashboard`

```typescript
interface DashboardStats {
  projects: { total: number; testSuites: number };
  executions: {
    passed: number;
    failed: number;
    total: number;
    weeklyCount: number;
    lastExecutedAt: string | null;
  };
  recentExecutions: Array<{
    id: string;
    testSuiteName: string;
    projectName: string;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
    startedAt: string;
    summary: { passed: number; failed: number; pending: number; total: number };
  }>;
  projectSummaries: Array<{
    id: string;
    name: string;
    testSuiteCount: number;
    lastExecution: { passRate: number } | null;
  }>;
}
```

#### 1.2 統計カードの動的化

- 成功数・失敗数を実データで表示
- ローディング状態のスケルトン表示

#### 1.3 最近の実行セクション

- 最新5件の実行履歴を表示
- StatusBadge + ProgressBarで状態を可視化
- 実行詳細ページへのリンク

#### 1.4 サイドバーサマリーの動的化

- 今週のテスト回数を実データで表示
- 最終実行日時を相対時間で表示

## 実装範囲

**今回の実装**: Phase 1のみ（未実装機能の完成）

**将来検討（実装対象外）**:
- 失敗テストへの導線カード
- プロジェクトカードへのプログレスバー追加
- クイックアクション強化
- トレンドグラフ、アクティビティフィード

## 変更対象ファイル

### バックエンド
- `apps/api/src/routes/users.ts` - 新規エンドポイント追加
- `apps/api/src/controllers/user.controller.ts` - getDashboardメソッド追加
- `apps/api/src/services/user.service.ts` - 統計集計ロジック追加

### フロントエンド
- `apps/web/src/pages/Dashboard.tsx` - メイン画面の更新
- `apps/web/src/lib/api.ts` - APIクライアント追加

### 新規コンポーネント（必要に応じて）
- `ExecutionRow` - 実行履歴の行コンポーネント
- `ActionAlert` - 失敗テストへの導線カード

## 検証方法

1. `docker compose exec dev pnpm test` でユニットテスト実行
2. ブラウザでダッシュボード画面を確認
   - 統計カードに実数値が表示される
   - 最近の実行セクションに履歴が表示される
   - サイドバーのサマリーが動的に更新される
3. テスト実行後、ダッシュボードの数値が更新されることを確認
