# システム管理者機能

## 概要

システム管理者（運営者）向けの管理機能を提供する。ユーザー認証とは完全に独立したセッション管理を持ち、SaaS全体のユーザー管理、システム監視、運用を行うための機能群。

### 機能範囲

- **管理者認証**: メール/パスワード認証、2要素認証（TOTP）
- **システム監視**: ダッシュボード、システムヘルス確認
- **ユーザー管理**: ユーザー一覧、詳細閲覧（停止/削除は Phase 2）
- **監査ログ**: 管理者操作の記録

### 実装状況

| カテゴリ | 状態 | 備考 |
|---------|------|------|
| 管理者認証 | ✅ 実装済 | APIのみ |
| 2FA（TOTP） | ✅ 実装済 | APIのみ |
| ダッシュボード | ✅ 実装済 | APIのみ |
| ユーザー管理（一覧・詳細） | ✅ 実装済 | APIのみ |
| 監査ログ | ✅ 実装済 | APIのみ |
| 管理画面UI | 🔲 未実装 | Phase 2 |
| ユーザー停止/有効化/削除 | 🔲 未実装 | Phase 2 |
| 組織管理（一覧） | ✅ 実装済 | APIのみ |
| 組織管理（詳細） | ✅ 実装済 | APIのみ |
| 課金管理 | 🔲 未実装 | Phase 2 |

## 機能一覧

### 管理者認証

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-AUTH-001 | 管理者ログイン | メール/パスワードでログイン | 実装済 |
| ADM-AUTH-002 | 管理者ログアウト | セッションを終了 | 実装済 |
| ADM-AUTH-003 | セッション延長 | セッション有効期限を延長 | 実装済 |
| ADM-AUTH-004 | 現在の管理者情報取得 | 認証中の管理者情報を取得 | 実装済 |

### 2要素認証（TOTP）

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-2FA-001 | 2FAセットアップ | TOTP認証のセットアップを開始 | 実装済 |
| ADM-2FA-002 | 2FA有効化 | 確認コードを送信して2FAを有効化 | 実装済 |
| ADM-2FA-003 | 2FA検証 | ログイン時の2FA検証 | 実装済 |
| ADM-2FA-004 | 2FA無効化 | 2FAを無効化 | 実装済 |

### ダッシュボード

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-MON-001 | システム統計表示 | ユーザー・組織・実行統計を表示 | 実装済 |
| ADM-MON-002 | システムヘルス確認 | API/DB/Redis/MinIOの状態確認 | 実装済 |
| ADM-MON-003 | 収益統計表示 | MRR・請求書ステータスを表示 | 実装済 |

### ユーザー管理

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-USR-001 | ユーザー一覧取得 | 検索・フィルタ・ソート対応 | 実装済 |
| ADM-USR-002 | ユーザー詳細取得 | 詳細情報・統計・所属組織を表示 | 実装済 |
| ADM-USR-003 | ユーザー停止 | ユーザーアカウントを一時停止 | 未実装 |
| ADM-USR-004 | ユーザー有効化 | 停止したアカウントを再有効化 | 未実装 |
| ADM-USR-005 | ユーザー削除 | ユーザーアカウントを削除 | 未実装 |

### 組織管理

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-ORG-001 | 組織一覧取得 | 検索・フィルタ・ソート対応 | 実装済 |
| ADM-ORG-002 | 組織詳細取得 | 詳細情報・統計・メンバー・プロジェクト・サブスクリプション・監査ログを表示 | 実装済 |
| ADM-ORG-003 | 組織停止 | 組織の一時停止 | 未実装 |
| ADM-ORG-004 | 組織有効化 | 停止組織の復帰 | 未実装 |
| ADM-ORG-005 | 組織削除 | 組織の完全削除 | 未実装 |

### 監査ログ

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-AUD-001 | 監査ログ記録 | 管理者の全操作を自動記録 | 実装済 |

## 業務フロー

### 管理者ログインフロー（2FA含む）

```mermaid
sequenceDiagram
    participant A as 管理者
    participant F as Admin App
    participant B as API
    participant DB as データベース

    A->>F: ログイン画面アクセス
    F->>A: ログインフォーム表示
    A->>F: メール/パスワード入力
    F->>B: POST /admin/auth/login
    B->>DB: 認証情報検証

    alt アカウントロック中
        B->>F: 423 ADMIN_ACCOUNT_LOCKED
        F->>A: ロック中メッセージ表示
    else 認証失敗
        B->>DB: failed_attempts インクリメント
        alt 5回以上失敗
            B->>DB: locked_until 設定（30分後）
            B->>DB: 監査ログ記録（ACCOUNT_LOCKED）
        end
        B->>DB: 監査ログ記録（LOGIN_FAILED）
        B->>F: 401 ADMIN_INVALID_CREDENTIALS
        F->>A: エラーメッセージ表示
    else 認証成功 & 2FA無効
        B->>DB: failed_attempts リセット
        B->>DB: セッション作成
        B->>DB: 監査ログ記録（LOGIN）
        B->>F: Cookie設定 + ユーザー情報
        F->>A: ダッシュボードへリダイレクト
    else 認証成功 & 2FA有効
        B->>F: requiresTwoFactor: true + tempToken
        F->>A: 2FA入力画面表示
        A->>F: TOTPコード入力
        F->>B: POST /admin/auth/2fa/verify
        B->>DB: TOTPコード検証
        alt 検証失敗
            B->>F: 400 ADMIN_INVALID_TOTP_CODE
            F->>A: エラーメッセージ（再試行）
        else 検証成功
            B->>DB: failed_attempts リセット
            B->>DB: セッション作成
            B->>DB: 監査ログ記録（LOGIN）
            B->>F: Cookie設定 + ユーザー情報
            F->>A: ダッシュボードへリダイレクト
        end
    end
```

### 2FAセットアップフロー

```mermaid
sequenceDiagram
    participant A as 管理者
    participant F as Admin App
    participant B as API
    participant DB as データベース
    participant Auth as 認証アプリ

    A->>F: 2FA設定画面アクセス
    F->>B: POST /admin/auth/2fa/setup
    B->>B: TOTPシークレット生成
    B->>DB: シークレット一時保存
    B->>DB: 監査ログ記録（2FA_SETUP）
    B->>F: secret + otpauth URI
    F->>F: QRコード生成
    F->>A: QRコード表示
    A->>Auth: QRコードスキャン
    Auth->>A: 6桁コード表示
    A->>F: コード入力
    F->>B: POST /admin/auth/2fa/enable
    B->>DB: TOTP検証
    alt 検証成功
        B->>DB: totpEnabled = true
        B->>DB: 監査ログ記録（2FA_ENABLED）
        B->>F: 成功レスポンス
        F->>A: 有効化完了メッセージ
    else 検証失敗
        B->>F: 400 ADMIN_INVALID_TOTP_CODE
        F->>A: エラーメッセージ（再試行）
    end
```

### ダッシュボード表示フロー

```mermaid
sequenceDiagram
    participant A as 管理者
    participant F as Admin App
    participant B as API
    participant Cache as Redis
    participant DB as データベース

    A->>F: ダッシュボード画面アクセス
    F->>B: GET /admin/dashboard
    B->>B: セッション検証
    B->>Cache: キャッシュ確認（admin:dashboard）
    alt キャッシュヒット
        Cache->>B: キャッシュデータ
    else キャッシュミス
        B->>DB: ユーザー統計取得
        B->>DB: 組織統計取得
        B->>DB: 実行統計取得
        B->>DB: 収益統計取得
        B->>B: システムヘルスチェック
        B->>Cache: キャッシュ保存（TTL: 5分）
    end
    B->>F: 統計データ
    F->>A: ダッシュボード表示
```

### ユーザー詳細閲覧フロー

```mermaid
sequenceDiagram
    participant A as 管理者
    participant F as Admin App
    participant B as API
    participant Cache as Redis
    participant DB as データベース

    A->>F: ユーザー一覧画面
    A->>F: ユーザーをクリック
    F->>B: GET /admin/users/:id
    B->>B: セッション検証
    B->>Cache: キャッシュ確認
    alt キャッシュヒット
        Cache->>B: キャッシュデータ
    else キャッシュミス
        B->>DB: ユーザー基本情報取得
        B->>DB: アクティビティ情報取得
        B->>DB: 統計情報取得
        B->>DB: 所属組織一覧取得
        B->>DB: OAuth連携情報取得
        B->>DB: サブスクリプション情報取得
        B->>DB: 最近の監査ログ取得（10件）
        B->>Cache: キャッシュ保存（TTL: 30秒）
    end
    B->>F: ユーザー詳細データ
    F->>A: ユーザー詳細画面表示
```

### 組織詳細閲覧フロー

```mermaid
sequenceDiagram
    participant A as 管理者
    participant F as Admin App
    participant B as API
    participant Cache as Redis
    participant DB as データベース

    A->>F: 組織一覧画面
    A->>F: 組織をクリック
    F->>B: GET /admin/organizations/:id
    B->>B: セッション検証
    B->>Cache: キャッシュ確認
    alt キャッシュヒット
        Cache->>B: キャッシュデータ
    else キャッシュミス
        B->>DB: 組織基本情報取得
        B->>DB: 統計情報取得（メンバー数、プロジェクト数、テストスイート数、実行数）
        B->>DB: メンバー一覧取得（最新20件）
        B->>DB: プロジェクト一覧取得（最新10件）
        B->>DB: サブスクリプション情報取得
        B->>DB: 監査ログ取得（最新10件）
        B->>Cache: キャッシュ保存（TTL: 30秒）
    end
    B->>F: 組織詳細データ
    F->>A: 組織詳細画面表示
```

## データモデル

```mermaid
erDiagram
    AdminUser ||--o{ AdminSession : "has"
    AdminUser ||--o{ AdminAuditLog : "performs"

    AdminUser {
        uuid id PK
        string email UK
        string password_hash
        string name
        AdminRoleType role
        string totp_secret
        boolean totp_enabled
        int failed_attempts
        timestamp locked_until
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    AdminSession {
        uuid id PK
        uuid admin_user_id FK
        string token UK
        string user_agent
        string ip_address
        timestamp last_active_at
        timestamp expires_at
        timestamp revoked_at
        timestamp created_at
    }

    AdminAuditLog {
        uuid id PK
        uuid admin_user_id FK
        string action
        string target_type
        string target_id
        json details
        string ip_address
        string user_agent
        timestamp created_at
    }
```

### テーブル概要

| テーブル | 説明 |
|---------|------|
| AdminUser | 管理者ユーザー情報 |
| AdminSession | 管理者セッション情報 |
| AdminAuditLog | 管理者操作の監査ログ |

### 監査ログアクション一覧

| アクション | 説明 |
|-----------|------|
| LOGIN | ログイン成功 |
| LOGOUT | ログアウト |
| LOGIN_FAILED | ログイン失敗 |
| 2FA_SETUP | 2FAセットアップ開始 |
| 2FA_ENABLED | 2FA有効化 |
| 2FA_DISABLED | 2FA無効化 |
| SESSION_REFRESH | セッション延長 |
| ACCOUNT_LOCKED | アカウントロック |

## ビジネスルール

### 認証ルール

#### パスワード要件

| 項目 | 要件 |
|------|------|
| 最小文字数 | 8文字 |
| 複雑性 | 大文字、小文字、数字、記号のうち3種類以上 |
| ハッシュ化 | bcrypt（コストファクター: 12） |

#### アカウントロック

| 項目 | 値 |
|------|-----|
| ロック閾値 | 連続5回のログイン失敗 |
| ロック時間 | 30分 |
| ロック解除後 | 失敗カウントがリセット |

#### セッション管理

| 項目 | 値 |
|------|-----|
| セッション有効期限 | 8時間 |
| 非アクティブタイムアウト | 30分 |
| トークン形式 | 32バイトの暗号的に安全なランダム値 |
| Cookie属性 | HttpOnly, Secure, SameSite=Strict, Path=/admin |

### 2FAルール

| 項目 | 値 |
|------|-----|
| プロトコル | RFC 6238（TOTP） |
| 発行者名 | Agentest Admin |
| 時間ステップ | 30秒 |
| コード桁数 | 6桁 |
| シークレット保存 | AES-256-GCM暗号化 |

### レート制限

| エンドポイント | 制限 |
|---------------|------|
| /admin/auth/login | 5回 / 15分（IP単位） |
| /admin/auth/2fa/verify | 5回 / 15分（IP単位） |
| その他 | 100回 / 15分 |

## 権限

### ロール定義

| ロール | 説明 |
|--------|------|
| SUPER_ADMIN | 最高権限管理者（全機能へのアクセス） |
| ADMIN | 一般管理者（ユーザー管理、設定変更） |
| VIEWER | 閲覧専用（参照のみ） |

### 権限マトリクス

| 機能 | SUPER_ADMIN | ADMIN | VIEWER |
|------|:-----------:|:-----:|:------:|
| ダッシュボード閲覧 | ✓ | ✓ | ✓ |
| ユーザー一覧閲覧 | ✓ | ✓ | ✓ |
| ユーザー詳細閲覧 | ✓ | ✓ | ✓ |
| ユーザー停止/再開 | ✓ | ✓ | - |
| ユーザー削除 | ✓ | - | - |
| 組織一覧閲覧 | ✓ | ✓ | ✓ |
| 組織設定変更 | ✓ | ✓ | - |
| システム設定変更 | ✓ | - | - |
| 管理者ユーザー管理 | ✓ | - | - |
| 監査ログ閲覧 | ✓ | ✓ | ✓ |

## 設定値

### 認証設定

| 項目 | 値 | 説明 |
|------|-----|------|
| ADMIN_SESSION_EXPIRY | 8h | セッション有効期限 |
| ADMIN_SESSION_INACTIVE_TIMEOUT | 30m | 非アクティブタイムアウト |
| ADMIN_MAX_FAILED_ATTEMPTS | 5 | ログイン失敗閾値 |
| ADMIN_LOCKOUT_DURATION | 30m | アカウントロック時間 |
| ADMIN_BCRYPT_ROUNDS | 12 | bcryptコストファクター |

### キャッシュ設定

| キャッシュキー | TTL | 説明 |
|---------------|-----|------|
| admin:dashboard | 5分 | ダッシュボード統計 |
| admin:users:${hash} | 60秒 | ユーザー一覧 |
| admin:user:detail:${id} | 30秒 | ユーザー詳細 |
| admin:organizations:${hash} | 60秒 | 組織一覧 |
| admin:organization:detail:${id} | 30秒 | 組織詳細 |

## セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| パスワード | bcryptハッシュ化、複雑性要件 |
| ブルートフォース | レート制限、アカウントロック |
| セッションハイジャック | HttpOnly Cookie、Secure、SameSite=Strict |
| TOTPシークレット | AES-256-GCM暗号化保存 |
| 監査証跡 | 全認証イベントをログ記録 |
| タイミング攻撃 | ロック中もロック状態を示さない |

## 関連機能

### API仕様

- [管理者認証 API](../../api/admin-auth.md) - ログイン、2FA、セッション管理
- [管理者ダッシュボード API](../../api/admin-dashboard.md) - システム統計
- [管理者ユーザー管理 API](../../api/admin-users.md) - ユーザー一覧・詳細
- [管理者組織管理 API](../../api/admin-organizations.md) - 組織一覧

### データベース設計

- [管理者認証テーブル設計](../database/admin-auth.md) - AdminUser, AdminSession, AdminAuditLog

### 要件定義

- [システム管理者機能要件](../../requirements/admin-system.md)
