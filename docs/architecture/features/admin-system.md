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
| システム管理者アカウント管理 | ✅ 実装済 | API + UI |
| システム管理者招待 | ✅ 実装済 | API + UI |
| 初回セットアップウィザード | ✅ 実装済 | API + UI |

## 機能一覧

### 初回セットアップ

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-SETUP-001 | セットアップ状態確認 | AdminUserが0件かどうかを判定し、セットアップが必要か返却 | 実装済 |
| ADM-SETUP-002 | 初回セットアップ実行 | 名前・メール・パスワードを入力してSUPER_ADMINアカウントを作成 | 実装済 |

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
| ADM-ORG-002 | 組織詳細取得 | 詳細情報・統計・メンバー・プロジェクト・監査ログを表示 | 実装済 |
| ADM-ORG-003 | 組織停止 | 組織の一時停止 | 未実装 |
| ADM-ORG-004 | 組織有効化 | 停止組織の復帰 | 未実装 |
| ADM-ORG-005 | 組織削除 | 組織の完全削除 | 未実装 |

### 監査ログ

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-AUD-001 | 全体監査ログ閲覧 | 全組織の監査ログを横断検索・閲覧 | 実装済 |
| ADM-AUD-002 | 監査ログ記録 | 管理者の全操作を自動記録 | 実装済 |

### システム管理者アカウント管理

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-SEC-001-1 | 管理者一覧取得 | 検索・フィルタ・ソート対応 | 実装済 |
| ADM-SEC-001-2 | 管理者詳細取得 | セッション・監査ログ情報付き | 実装済 |
| ADM-SEC-001-3 | 管理者招待 | メール送信、24時間有効 | 実装済 |
| ADM-SEC-001-4 | 管理者更新 | ロール変更制約あり | 実装済 |
| ADM-SEC-001-5 | 管理者削除 | 論理削除、最後のSUPER_ADMIN保護 | 実装済 |
| ADM-SEC-001-6 | ロック解除・2FAリセット | セキュリティ管理 | 実装済 |

## 業務フロー

### 初回セットアップフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as Admin App
    participant B as API
    participant DB as データベース

    U->>F: http://localhost:3003 にアクセス
    F->>B: GET /admin/setup/status
    B->>DB: AdminUser件数を確認

    alt セットアップ不要（AdminUser > 0件）
        B->>F: { isSetupRequired: false }
        F->>U: ログイン画面にリダイレクト
    else セットアップ必要（AdminUser = 0件）
        B->>F: { isSetupRequired: true }
        F->>U: セットアップフォーム表示
        U->>F: 名前・メール・パスワード入力
        F->>F: パスワード要件のリアルタイム検証
        F->>B: POST /admin/setup（CSRF保護）
        B->>B: バリデーション・パスワードハッシュ化
        B->>DB: Serializableトランザクション開始
        B->>DB: AdminUser件数を再確認
        alt 既にセットアップ済み（競合）
            B->>F: 403 AUTHORIZATION_ERROR
            F->>U: セットアップ済みメッセージ表示
        else 未セットアップ
            B->>DB: SUPER_ADMINアカウント作成
            B->>DB: 監査ログ記録（INITIAL_SETUP）
            B->>F: 201 Created
            F->>U: 成功メッセージ + ログイン画面リンク
        end
    end
```

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
        B->>DB: 監査ログ取得（最新10件）
        B->>Cache: キャッシュ保存（TTL: 30秒）
    end
    B->>F: 組織詳細データ
    F->>A: 組織詳細画面表示
```

### 管理者招待フロー

```mermaid
sequenceDiagram
    participant SA as SUPER_ADMIN
    participant F as Admin App
    participant B as API
    participant DB as データベース
    participant Mail as メールサービス
    participant NA as 新管理者

    SA->>F: 管理者招待モーダルを開く
    F->>SA: 入力フォーム表示
    SA->>F: メール・名前・ロール入力
    F->>B: POST /admin/admin-users
    B->>B: セッション検証（SUPER_ADMIN権限確認）
    B->>DB: メールアドレス重複チェック
    alt メール重複
        B->>F: 409 ADMIN_USER_ALREADY_EXISTS
        F->>SA: エラー表示
    else 重複なし
        B->>DB: 招待トークン生成・保存（24時間有効）
        B->>Mail: 招待メール送信
        B->>DB: 監査ログ記録（ADMIN_USER_INVITE）
        B->>F: 201 Created + 招待情報
        F->>SA: 成功メッセージ表示
    end

    Note over NA: 招待メール受信

    NA->>F: 招待リンクアクセス
    F->>B: GET /admin/invitations/:token
    alt 招待期限切れ or 無効
        B->>F: 400/404 エラー
        F->>NA: エラーページ表示
    else 有効
        B->>F: 招待情報
        F->>NA: パスワード設定フォーム表示
    end

    NA->>F: パスワード入力
    F->>B: POST /admin/invitations/:token/accept
    B->>DB: パスワードハッシュ化
    B->>DB: 管理者アカウント作成
    B->>DB: 招待トークン無効化（acceptedAt設定）
    B->>DB: 監査ログ記録（ADMIN_INVITATION_ACCEPTED）
    B->>F: 201 Created
    F->>NA: ログイン画面へリダイレクト
```

## データモデル

```mermaid
erDiagram
    AdminUser ||--o{ AdminSession : "has"
    AdminUser ||--o{ AdminAuditLog : "performs"
    AdminUser ||--o{ AdminInvitation : "invites"

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

    AdminInvitation {
        uuid id PK
        string email
        string name
        AdminRoleType role
        string token UK
        uuid invited_by_id FK
        timestamp accepted_at
        timestamp expires_at
        timestamp created_at
    }
```

### テーブル概要

| テーブル | 説明 |
|---------|------|
| AdminUser | 管理者ユーザー情報 |
| AdminSession | 管理者セッション情報 |
| AdminAuditLog | 管理者操作の監査ログ |
| AdminInvitation | 管理者招待情報 |

### 監査ログアクション一覧

| アクション | 説明 |
|-----------|------|
| INITIAL_SETUP | 初回セットアップ（SUPER_ADMIN作成） |
| LOGIN | ログイン成功 |
| LOGOUT | ログアウト |
| LOGIN_FAILED | ログイン失敗 |
| 2FA_SETUP | 2FAセットアップ開始 |
| 2FA_ENABLED | 2FA有効化 |
| 2FA_DISABLED | 2FA無効化 |
| SESSION_REFRESH | セッション延長 |
| ACCOUNT_LOCKED | アカウントロック |
| ADMIN_USER_LIST | システム管理者一覧閲覧 |
| ADMIN_USER_VIEW | システム管理者詳細閲覧 |
| ADMIN_USER_INVITE | システム管理者招待 |
| ADMIN_USER_UPDATE | システム管理者更新 |
| ADMIN_USER_DELETE | システム管理者削除 |
| ADMIN_USER_UNLOCK | アカウントロック解除 |
| ADMIN_USER_RESET_2FA | 2FAリセット |
| ADMIN_INVITATION_ACCEPTED | 招待受諾 |

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
| admin:audit-logs:${hash} | 30秒 | 全体監査ログ一覧 |

## セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| パスワード | bcryptハッシュ化、複雑性要件 |
| ブルートフォース | レート制限、アカウントロック |
| セッションハイジャック | HttpOnly Cookie、Secure、SameSite=Strict |
| TOTPシークレット | AES-256-GCM暗号化保存 |
| 監査証跡 | 全認証イベントをログ記録 |
| タイミング攻撃 | ロック中もロック状態を示さない |
| CSRF保護 | Origin/Refererヘッダー検証（初回セットアップ） |
| 競合防止 | Serializableトランザクションで重複作成を防止 |

## 関連機能

### API仕様

- [初回セットアップ API](../../api/admin-setup.md) - 初回セットアップウィザード
- [管理者認証 API](../../api/admin-auth.md) - ログイン、2FA、セッション管理
- [管理者ダッシュボード API](../../api/admin-dashboard.md) - システム統計
- [管理者ユーザー管理 API](../../api/admin-users.md) - ユーザー一覧・詳細
- [管理者組織管理 API](../../api/admin-organizations.md) - 組織一覧・詳細
- [管理者監査ログ API](../../api/admin-audit-logs.md) - 全体監査ログ閲覧
- [システム管理者管理 API](../../api/admin-admin-users.md) - システム管理者の一覧・招待・更新・削除

### データベース設計

- [管理者認証テーブル設計](../database/admin-auth.md) - AdminUser, AdminSession, AdminAuditLog

### 要件定義

- [システム管理者機能要件](../../requirements/admin-system.md)
