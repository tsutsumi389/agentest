# ドキュメント更新計画 - テスト完了/失敗通知

## 概要

通知機能（テスト完了/失敗通知）の実装完了に伴い、関連ドキュメントを更新する。

## 更新対象ファイル

| ファイル | 更新内容 |
|---------|---------|
| `docs/architecture/features/notification.md` | テスト完了/失敗通知の詳細仕様を追加 |
| `docs/architecture/features/test-execution.md` | 関連機能に通知機能への参照を追加 |

## 更新不要と判断したファイル

| ファイル | 理由 |
|---------|------|
| `docs/requirements/test-management.md` | Slack通知は別機能。詳細は機能ドキュメントで管理 |
| `docs/api/notifications.md` | 通知タイプ一覧として十分 |
| `docs/architecture/database/notification.md` | スキーマ定義として十分 |
| `docs/architecture/overview.md` | 全体像として適切な粒度 |
| `docs/guides/development.md` | 一般的な開発ガイドとして十分 |

---

## 更新内容詳細

### 1. docs/architecture/features/notification.md

**変更箇所**: 「通知タイプ」セクション（173行目）の後に新セクションを追加

**追加内容**:

```markdown
### テスト完了/失敗通知の詳細

テスト実行において全ての期待結果が判定完了したタイミングで通知を送信する。

#### 通知トリガー条件

| 条件 | 説明 |
|------|------|
| 全期待結果が判定完了 | PENDING の期待結果が 0 件になった時点 |
| 実行者と判定者が異なる | 自分で開始したテストを自分で完了させた場合は通知しない |
| 実行者が存在する | executedByUserId が設定されている場合のみ |

#### 通知タイプの選択

| 条件 | 通知タイプ |
|------|-----------|
| FAIL が 0 件 | `TEST_COMPLETED` |
| FAIL が 1 件以上 | `TEST_FAILED` |

#### 通知本文の形式

```
「{テストスイート名}」のテスト実行が完了しました（成功: X件、失敗: Y件、スキップ: Z件／合計N件）
```

※ 0件の項目は省略される

#### 通知データ（data フィールド）

```json
{
  "executionId": "uuid",
  "testSuiteId": "uuid",
  "testSuiteName": "テストスイート名",
  "passCount": 10,
  "failCount": 2,
  "skippedCount": 1,
  "totalCount": 13
}
```

#### エラーハンドリング

- 通知送信に失敗しても期待結果の更新処理は成功する（非同期・非依存）
```

---

### 2. docs/architecture/features/test-execution.md

**変更箇所**: 「関連機能」セクション（862-867行目）

**変更前**:
```markdown
## 関連機能

- [テストスイート管理](./test-suite-management.md) - 実行対象のテストスイート
- [テストケース管理](./test-case-management.md) - 実行対象のテストケース
- [プロジェクト管理](./project-management.md) - 環境設定の参照元
- [監査ログ](./audit-log.md) - 実行操作の記録
```

**変更後**:
```markdown
## 関連機能

- [テストスイート管理](./test-suite-management.md) - 実行対象のテストスイート
- [テストケース管理](./test-case-management.md) - 実行対象のテストケース
- [プロジェクト管理](./project-management.md) - 環境設定の参照元
- [監査ログ](./audit-log.md) - 実行操作の記録
- [通知機能](./notification.md) - テスト完了/失敗通知
```

---

## 検証方法

1. ドキュメント更新後、リンクが正しく機能することを確認
2. notification.md の新セクションが既存の構造と整合していることを確認
