# 初回セットアップウィザード ドキュメント更新プラン

## Context

`docs/plans/ticklish-juggling-pumpkin.md` に基づく初回セットアップウィザード機能の実装が完了した。この実装により、管理者アカウント作成方法が `db:seed:admin` コマンドからブラウザベースのセットアップウィザードに変わった。既存ドキュメントにはこの新機能が反映されていないため、更新が必要。

---

## 更新対象ファイル

### 1. `docs/guides/getting-started.md` — 初回セットアップ手順の更新

**変更内容:**

- **ステップ5「データベースをセットアップ」** から `db:seed:admin` コマンドを削除
- **ステップ6「動作確認」** の後に **新ステップ「管理者アカウント作成」** を追加
  - `http://localhost:3003` にアクセスするとセットアップウィザードが表示される旨を記載
  - 名前・メールアドレス・パスワードを入力してSUPER_ADMINアカウントを作成するフローを説明
  - パスワード要件（8文字以上、大文字・小文字・数字・記号）を記載
- 固定のシードログイン情報テーブル（admin@example.com / password123）を削除

### 2. `docs/architecture/features/admin-system.md` — 初回セットアップ機能の追加

**変更内容:**

- **実装状況テーブル** に「初回セットアップウィザード」行を追加（✅ 実装済、API + UI）
- **機能一覧** に「初回セットアップ」セクションを追加
  - ADM-SETUP-001: セットアップ状態確認
  - ADM-SETUP-002: 初回セットアップ実行
- **業務フロー** に「初回セットアップフロー」のmermaid sequenceDiagramを追加
  - ブラウザアクセス → セットアップ状態チェック → リダイレクト → フォーム入力 → SUPER_ADMIN作成 → ログイン画面へ
- **監査ログアクション一覧** に `INITIAL_SETUP` を追加
- **セキュリティ考慮事項** に CSRF保護（Origin/Refererヘッダー検証）とSerializableトランザクションを追加

### 3. `docs/api/admin-setup.md` — 新規作成（セットアップAPI仕様）

**新規ファイル作成。** 既存APIドキュメントの構成パターン（`admin-auth.md` 等）に準拠。

**内容:**

- 概要: 初回セットアップAPI。AdminUserが0件の場合のみ動作
- ベースURL: `/admin/setup`
- エンドポイント一覧テーブル
- `GET /admin/setup/status` の仕様（Request/Response/Errors）
- `POST /admin/setup` の仕様（Request/Response/Errors）
  - バリデーションルール（initialSetupSchema）
  - CSRF保護の説明
- エラーコード一覧
- 使用例（JavaScript fetch）

### 4. `docs/README.md` — クイックリンクにセットアップAPI追加

**変更内容:**

- 「開発者向け」セクションに `[初回セットアップ API](./api/admin-setup.md)` を追加
- `admin-system.md` の関連ドキュメントセクションにもリンク追加

### 5. `docs/architecture/features/admin-system.md` — 関連ドキュメントにリンク追加

**変更内容:**

- 「API仕様」セクションに `[初回セットアップ API](../../api/admin-setup.md)` を追加

---

## 既存パターンの準拠ポイント

- 日本語でドキュメント記述（技術用語・コード例は英語維持）
- APIドキュメントは Request/Response の JSON例付き
- 業務フローは mermaid sequenceDiagram で記述
- 機能一覧は ID、機能名、説明、状態 のテーブル形式

---

## 検証方法

- 全ドキュメントのリンクが正しいことを確認（相対パスの整合性）
- mermaid図がレンダリングできることを確認
- 実際のセットアップフローと記述内容の整合性を確認
