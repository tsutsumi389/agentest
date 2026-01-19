# テスト実行画面の仕様変更 - 実装計画

## 概要

テスト実行画面の4つの仕様変更を実装します。

---

## 変更1: 「テストスイートに戻る」の遷移先変更

**対象**: `apps/web/src/components/execution/ExecutionOverviewPanel.tsx`

**変更内容**: リンクのURLに`?tab=executions`を追加

```typescript
// 変更前
to={`/test-suites/${execution.testSuiteId}`}

// 変更後
to={`/test-suites/${execution.testSuiteId}?tab=executions`}
```

---

## 変更2: テストケース詳細画面に「テストスイートに戻る」を追加

**対象ファイル**:
- `apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx`
- `apps/web/src/pages/Execution.tsx`

**変更内容**:
1. `ExecutionTestCaseDetailPanel`のpropsに`testSuiteId`を追加
2. パネル上部に戻るリンクを追加
3. `Execution.tsx`で`testSuiteId`を渡す

---

## 変更3+4: 確認者・確認日時のUI/UX改善 + エージェント実行時の表示

**対象**: `apps/web/src/components/execution/ExecutionResultItem.tsx`

**現在の表示**:
```
tsutsumi389 / 2026-01-19 07:39
```

**改善後の表示**:
```
[アバター] tsutsumi389                    2026-01-19 07:39
[アバター] tsutsumi389 (Claude Code経由)  2026-01-19 07:39
```

**変更内容**:
1. `AuthorAvatar`コンポーネントを使用してアバター表示
2. エージェント経由の場合は「ユーザー名 (エージェント名経由)」形式で表示
3. ユーザーがいればユーザーアバター、エージェントのみならBotアイコン

---

## 実装ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `ExecutionOverviewPanel.tsx` | URLにクエリパラメータ追加 |
| `ExecutionTestCaseDetailPanel.tsx` | props追加、戻るリンク追加 |
| `Execution.tsx` | testSuiteIdをpropsで渡す |
| `ExecutionResultItem.tsx` | UI改善、表示ロジック変更 |

---

## 検証方法

1. **遷移確認**: 実行画面から「テストスイートに戻る」→ 実行履歴タブが開くこと
2. **テストケース詳細**: 詳細画面に「テストスイートに戻る」が表示され、クリックで実行履歴タブに遷移
3. **確認者表示**: アバター付きで見やすく表示されること
4. **エージェント表示**: 「ユーザー名 (エージェント名経由)」形式で表示されること
