# 監査ログ機能 ドキュメント更新計画

## 概要

mossy-plotting-bee.md の実装完了に伴い、docs/ 配下のドキュメントを更新する。

## 実装された機能

1. **監査ログ詳細表示機能** - ログをクリックして詳細情報をモーダル表示
2. **監査ログエクスポート機能** - CSV/JSON形式でダウンロード

## 更新対象ドキュメント

### 1. docs/api/audit-logs.md（新規作成）

監査ログAPIの詳細ドキュメントを新規作成。

**記載内容**:
- エンドポイント一覧
- GET `/organizations/:organizationId/audit-logs` - ログ一覧取得
- GET `/organizations/:organizationId/audit-logs/export` - エクスポート
- クエリパラメータ仕様
- レスポンス例（JSON/CSV）
- 権限要件

### 2. docs/api/README.md（更新）

監査ログセクションを追加。

**追加箇所**: 組織セクションの後に「監査ログ」セクションを追加

```markdown
### 監査ログ

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/organizations/:organizationId/audit-logs` | 監査ログ一覧 |
| GET | `/organizations/:organizationId/audit-logs/export` | 監査ログエクスポート |

→ [監査ログ API 詳細](./audit-logs.md)
```

### 3. docs/architecture/features/audit-log.md（更新）

エクスポート機能と詳細表示機能を追加。

**機能一覧への追加**:
- AUD-006: 詳細表示 - ログクリックで詳細モーダル表示（実装済）
- AUD-007: エクスポート - CSV/JSON形式でダウンロード（実装済）

**画面仕様への追加**:
- 詳細表示モーダルの仕様
- エクスポートボタンと形式選択

**エクスポートフローの追加**:
- シーケンス図

## ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `docs/api/audit-logs.md` | 新規作成 | 監査ログAPI詳細 |
| `docs/api/README.md` | 更新 | 監査ログセクション追加 |
| `docs/architecture/features/audit-log.md` | 更新 | 詳細表示・エクスポート機能追加 |

## 実装順序

1. docs/api/audit-logs.md を新規作成
2. docs/api/README.md に監査ログセクションを追加
3. docs/architecture/features/audit-log.md にエクスポート機能を追加

## 検証方法

- 各ドキュメントファイルが正しく作成・更新されていることを確認
- リンクが正しく機能することを確認
- 実装内容とドキュメントの整合性を確認
