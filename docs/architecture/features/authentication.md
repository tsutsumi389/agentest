# 認証機能

## 概要

ユーザーがシステムにログインするための機能。メール/パスワード認証とOAuth 2.0（GitHub/Google）による認証をサポートし、JWTベースのセッション管理を提供する。

## 機能一覧

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| AUTH-001 | OAuthログイン | GitHub/Googleアカウントでログイン | 実装済 |
| AUTH-002 | ログアウト | セッションを終了 | 実装済 |
| AUTH-003 | トークン更新 | アクセストークンを自動更新 | 実装済 |
| AUTH-004 | セッション一覧 | 有効なセッションを確認 | 実装済 |
| AUTH-005 | セッション無効化 | 特定のセッションを終了 | 実装済 |
| AUTH-006 | 全セッション無効化 | 現在以外の全セッションを終了 | 実装済 |
| AUTH-007 | MCP OAuth 2.1認証 | MCPクライアント向けOAuth 2.1認証フロー | 実装済 |
| AUTH-008 | 動的クライアント登録 | MCPクライアントの動的登録（RFC 7591） | 実装済 |
| AUTH-009 | トークンイントロスペクション | アクセストークンの検証 | 実装済 |
| AUTH-010 | APIキー認証 | X-API-Keyヘッダーによる認証（MCP向け） | 実装済 |
| AUTH-011 | APIキー管理 | APIキーの作成・一覧・失効 | 実装済 |
| AUTH-012 | ハイブリッド認証 | OAuth/APIキー/Cookieの優先順位付き認証 | 実装済 |
| AUTH-013 | メール/パスワードログイン | メールアドレスとパスワードでログイン | 実装済 |
| AUTH-014 | メール/パスワード新規登録 | メールアドレスとパスワードでアカウント作成 | 実装済 |
| AUTH-015 | パスワードリセット要求 | パスワードリセットリンクをメール送信 | 実装済 |
| AUTH-016 | パスワードリセット実行 | リセットトークンで新しいパスワードを設定 | 実装済 |
| AUTH-017 | パスワード設定 | OAuthユーザーがパスワードを追加設定 | 実装済 |
| AUTH-018 | パスワード変更 | 既存パスワードを変更 | 実装済 |
| AUTH-019 | アカウントロック | ログイン失敗回数超過でロック | 実装済 |
| AUTH-020 | メールアドレス確認 | 登録時に確認メール送信、確認完了までログインブロック | 実装済 |
| AUTH-021 | 2FA（TOTP） | TOTP認証による二要素認証の設定・検証 | 実装済 |
| AUTH-022 | 2FAログイン検証 | 2FA有効ユーザーのログイン時にTOTPコード検証 | 実装済 |
| AUTH-023 | メール認証の省略 | `REQUIRE_EMAIL_VERIFICATION=false` でメール認証をスキップ | 実装済 |
| AUTH-024 | OAuthプロバイダー機能トグル | 環境変数でOAuthプロバイダーの有効/無効を制御、UIに自動反映 | 実装済 |

## 画面仕様

### ログイン画面

- **URL**: `/login`
- **表示要素**
  - メールアドレス入力欄
  - パスワード入力欄
  - 「パスワードを忘れた場合」リンク（→ `/forgot-password`）
  - ログインボタン
  - 区切り線（「または」）※ OAuthプロバイダーが1つ以上有効な場合のみ表示
  - GitHubログインボタン ※ GitHub OAuthが有効な場合のみ表示
  - Googleログインボタン ※ Google OAuthが有効な場合のみ表示
  - 「アカウントをお持ちでない場合は新規登録」リンク（→ `/register`）
- **操作**
  - メール/パスワード入力 → ログインボタンクリック → 認証
  - OAuthボタンクリック → OAuthプロバイダーへリダイレクト
  - 認証成功 → ダッシュボードへリダイレクト（`redirect`パラメータがあればそのURLへ）
  - 認証失敗 → エラーメッセージ表示
- **エラー表示**
  - 認証失敗時: 「メールアドレスまたはパスワードが正しくありません。」
  - アカウントロック時: 「アカウントがロックされています。しばらく経ってから再度お試しください。」
  - メール未確認時: `/check-email?email=...` にリダイレクト
  - OAuth失敗時: 「認証に失敗しました。再度お試しください。」
  - 2FA有効ユーザー: ログイン成功後 `/2fa/verify` にリダイレクト

### 2FA認証画面

- **URL**: `/2fa/verify`
- **表示要素**
  - 「認証コードを入力」見出し
  - 6桁コード入力欄（数字のみ、オートフォーカス）
  - 認証ボタン
  - ログアウトボタン
- **操作**
  - 6桁コード入力 → 認証ボタン → TOTP検証
  - 検証成功 → JWT発行 → ダッシュボードへリダイレクト
  - 検証失敗 → エラーメッセージ表示
  - ログアウトボタン → ログイン画面へリダイレクト
- **ガード条件**
  - `requires2FA=false` → `/login` にリダイレクト
  - `isAuthenticated=true` → `/dashboard` にリダイレクト

### 新規登録画面

- **URL**: `/register`
- **表示要素**
  - 名前入力欄
  - メールアドレス入力欄
  - パスワード入力欄
  - パスワード強度チェックリスト（大文字・小文字・数字・記号の充足状況をリアルタイム表示）
  - パスワード確認入力欄
  - アカウント作成ボタン
  - 区切り線（「または」）※ OAuthプロバイダーが1つ以上有効な場合のみ表示
  - GitHubで登録ボタン ※ GitHub OAuthが有効な場合のみ表示
  - Googleで登録ボタン ※ Google OAuthが有効な場合のみ表示
  - 「既にアカウントをお持ちの場合はログイン」リンク（→ `/login`）
- **操作**
  - フォーム入力 → アカウント作成ボタン → ユーザー作成 + 確認メール送信 → `/check-email` へリダイレクト
  - `REQUIRE_EMAIL_VERIFICATION=false` の場合: ユーザー作成 → JWT即発行 → `/`（ダッシュボード）へリダイレクト
  - OAuthボタン → OAuthプロバイダーへリダイレクト（メール確認不要で即ログイン）
- **バリデーション**
  - 名前: 1〜100文字
  - メールアドレス: 有効なメールアドレス形式
  - パスワード: 8〜100文字、大文字・小文字・数字・記号を各1文字以上
  - パスワード確認: パスワードと一致

### 確認メール送信済み画面

- **URL**: `/check-email?email=xxx`
- **表示要素**
  - 「確認メールを送信しました」メッセージ
  - 送信先メールアドレスの表示（URLクエリパラメータから取得）
  - 「再送信」ボタン → `POST /auth/resend-verification`
  - 「ログインに戻る」リンク（→ `/login`）
- **表示タイミング**
  - 新規登録完了後に自動リダイレクト
  - ログイン時にメール未確認エラー（`EMAIL_NOT_VERIFIED`）の場合にリダイレクト

### メールアドレス確認画面

- **URL**: `/verify-email?token=xxx`
- **表示要素**
  - ローディング表示（確認処理中）
  - 成功: 「メールアドレスが確認されました」メッセージ + ログインリンク
  - 失敗: エラーメッセージ + 再送信リンク
- **処理**
  - マウント時にURLクエリパラメータからトークンを取得
  - `GET /auth/verify-email?token=xxx` を呼び出し
  - 成功/失敗に応じて表示を切り替え

### パスワードリセット要求画面

- **URL**: `/forgot-password`
- **表示要素**
  - ステップ1: メールアドレス入力欄 + 送信ボタン
  - ステップ2: 送信完了メッセージ + 再送信ボタン
  - ログイン画面へのリンク
- **操作**
  - メールアドレス入力 → 送信ボタン → リセットメール送信
  - セキュリティのため、ユーザーが存在しない場合も同じ完了メッセージを表示

### パスワードリセット実行画面

- **URL**: `/reset-password?token=<token>`
- **表示要素**
  - 新しいパスワード入力欄
  - パスワード強度チェックリスト
  - パスワード確認入力欄
  - パスワードを設定ボタン
- **操作**
  - URLパラメータからトークンを取得
  - パスワード入力 → 設定ボタン → パスワード更新 → 完了メッセージ + ログインへのリンク
- **エラー表示**
  - トークン無効/期限切れ: エラーメッセージ + 再送信リンク（→ `/forgot-password`）

### OAuthコールバック画面

- **URL**: `/auth/callback`
- **表示要素**
  - ローディング表示
- **処理**
  - Cookieからユーザー情報を取得
  - 成功 → ダッシュボードへリダイレクト
  - 失敗 → ログイン画面へリダイレクト（エラーパラメータ付き）

### セッション管理画面

- **URL**: `/settings` （セキュリティタブ）
- **表示要素**
  - セッション一覧
    - デバイス情報（ブラウザ、OS）
    - IPアドレス
    - 最終アクセス日時
    - 現在のセッションにはバッジ表示
  - 「他のセッションをすべて終了」ボタン
- **操作**
  - 各セッションの「終了」ボタン → 確認ダイアログ → セッション無効化
  - 現在のセッションは終了ボタン非表示
  - 一括終了ボタン → 確認ダイアログ → 他セッション全無効化

### 2FA設定画面

- **URL**: `/settings` （セキュリティタブ内）
- **表示要素**
  - 2FA状態表示（有効/無効バッジ）
  - **有効化フロー**:
    1. 「2FAを有効にする」ボタンクリック
    2. QRコード + Base32シークレット表示
    3. 認証アプリでスキャン（または手動入力）
    4. 6桁コード入力 → 有効化確認
  - **無効化フロー**:
    1. 「2FAを無効にする」ボタンクリック
    2. パスワード確認ダイアログ
    3. パスワード入力 → 無効化

## 業務フロー

### メール/パスワードログインフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース

    U->>F: メールアドレス/パスワードを入力
    F->>B: POST /api/auth/login
    B->>DB: メールアドレスでユーザー検索
    alt ユーザーが存在しない
        B->>B: ダミーハッシュと比較（タイミング攻撃対策）
        B->>F: 401 認証失敗
    else アカウントロック中
        B->>F: 401 アカウントロック中
    else ユーザーが存在
        B->>B: bcryptでパスワード検証
        alt パスワード不一致
            B->>DB: 失敗回数インクリメント
            alt 5回以上失敗
                B->>DB: アカウントロック（30分）
            end
            B->>F: 401 認証失敗
        else パスワード一致
            B->>DB: 失敗回数リセット
            alt メールアドレス未確認
                B->>F: 401 EMAIL_NOT_VERIFIED
                F->>U: /check-email にリダイレクト
            else メールアドレス確認済み & 2FA有効
                B->>B: 一時トークン生成（crypto.randomBytes(32)）
                B->>DB: Redis に一時トークン保存（5分TTL）
                B->>F: requires2FA: true + twoFactorToken（JWT未発行）
                F->>U: /2fa/verify にリダイレクト
                U->>F: 6桁TOTPコード入力
                F->>B: POST /api/auth/2fa/verify
                B->>DB: Redis からトークン検証 + TOTP検証
                B->>DB: セッション作成
                B->>B: JWT発行（アクセス・リフレッシュ）
                B->>F: Cookie設定 + ユーザー情報
                F->>U: ダッシュボード表示
            else メールアドレス確認済み & 2FA無効
                B->>DB: セッション作成
                B->>B: JWT発行（アクセス・リフレッシュ）
                B->>F: Cookie設定 + ユーザー情報
                F->>U: ダッシュボード表示
            end
        end
    end
```

### 新規登録フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース
    participant M as メールサービス

    U->>F: 名前/メール/パスワードを入力
    F->>F: クライアントバリデーション
    F->>B: POST /api/auth/register
    B->>B: Zodスキーマバリデーション
    B->>DB: メールアドレス重複チェック
    alt メールアドレスが既に存在
        B->>F: 409 メールアドレスが既に使用されています
    else REQUIRE_EMAIL_VERIFICATION=false（メール認証スキップ）
        B->>B: bcryptでパスワードハッシュ化（12ラウンド）
        B->>DB: ユーザー作成（emailVerified=true）
        B->>DB: セッション作成
        B->>B: JWT発行（アクセス・リフレッシュ）
        B->>F: 201 Cookie設定 + ユーザー情報（emailVerificationSkipped: true）
        F->>U: /（ダッシュボード）にリダイレクト
    else REQUIRE_EMAIL_VERIFICATION=true（デフォルト）
        B->>B: bcryptでパスワードハッシュ化（12ラウンド）
        B->>DB: ユーザー作成（emailVerified=false）
        B->>B: 確認トークン生成（32バイトランダム）
        B->>DB: EmailVerificationToken保存（SHA-256ハッシュ、有効期限24時間）
        B->>M: 確認メール送信
        B->>F: 201 ユーザー情報（JWT未発行）
        F->>U: /check-email にリダイレクト
    end

    Note over U,M: REQUIRE_EMAIL_VERIFICATION=true の場合のみ

    U->>F: /verify-email?token=xxx にアクセス
    F->>B: GET /api/auth/verify-email?token=xxx
    B->>DB: トークンハッシュで検索・検証
    alt トークンが無効または期限切れ
        B->>F: 400 トークンが無効です
    else トークンが有効
        B->>DB: emailVerified=true に更新
        B->>DB: トークンを使用済みにマーク
        B->>F: 200 メールアドレスが確認されました
        F->>U: 確認完了メッセージ + ログインへのリンク
    end
```

### パスワードリセットフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース
    participant M as メールサービス

    U->>F: メールアドレスを入力
    F->>B: POST /api/auth/forgot-password
    B->>F: 200 送信しました（常に同じレスポンス）
    B-->>DB: ユーザー検索（非同期）
    alt ユーザーが存在
        B-->>B: リセットトークン生成（32バイトランダム）
        B-->>DB: トークンハッシュ保存（SHA-256、有効期限1時間）
        B-->>M: リセットメール送信
    end

    Note over U,M: ユーザーがメールのリンクをクリック

    U->>F: /reset-password?token=xxx にアクセス
    F->>F: 新しいパスワードを入力
    F->>B: POST /api/auth/reset-password
    B->>DB: トークンハッシュで検索・検証
    alt トークンが無効または期限切れ
        B->>F: 400 トークンが無効です
    else トークンが有効
        B->>B: bcryptでパスワードハッシュ化
        B->>DB: パスワード更新
        B->>DB: トークンを使用済みにマーク
        B->>DB: 全セッション無効化
        B->>F: 200 パスワードがリセットされました
        F->>U: 完了メッセージ + ログインへのリンク
    end
```

### OAuthログインフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant P as OAuthプロバイダー
    participant DB as データベース

    U->>F: ログインボタンをクリック
    F->>B: /api/auth/{provider} へリダイレクト
    B->>P: 認可リクエスト
    P->>U: 認可画面表示
    U->>P: 認可を許可
    P->>B: 認可コード
    B->>P: アクセストークン要求
    P->>B: アクセストークン + ユーザー情報
    B->>DB: ユーザー作成または取得
    B->>DB: セッション作成
    B->>B: JWT発行（アクセス・リフレッシュ）
    B->>F: Cookie設定 + /auth/callback へリダイレクト
    F->>B: /api/auth/me でユーザー情報取得
    B->>F: ユーザー情報
    F->>U: ダッシュボード表示
```

### トークン更新フロー

```mermaid
sequenceDiagram
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース

    F->>B: APIリクエスト（アクセストークン付き）
    B->>B: トークン検証
    alt トークン有効
        B->>F: レスポンス
    else トークン期限切れ
        B->>F: 401 Unauthorized
        F->>B: /api/auth/refresh（リフレッシュトークン付き）
        B->>DB: リフレッシュトークン検証
        alt 有効
            B->>DB: 古いトークン無効化
            B->>DB: 新規トークン・セッション作成
            B->>F: 新規トークン（Cookie設定）
            F->>B: APIリクエスト再試行
            B->>F: レスポンス
        else 無効または期限切れ
            B->>F: 401 Unauthorized
            F->>U: ログイン画面へリダイレクト
        end
    end
```

### ログアウトフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース

    U->>F: ログアウトボタンをクリック
    F->>B: POST /api/auth/logout
    B->>DB: セッション無効化（revokedAt設定）
    B->>DB: リフレッシュトークン無効化
    B->>F: Cookie削除 + 成功レスポンス
    F->>F: 認証ストアをクリア
    F->>U: ログイン画面へリダイレクト
```

## データモデル

```mermaid
erDiagram
    User ||--o{ Account : "has"
    User ||--o{ Session : "has"
    User ||--o{ RefreshToken : "has"
    User ||--o{ PasswordResetToken : "has"
    User ||--o{ EmailVerificationToken : "has"

    User {
        uuid id PK
        string email UK
        string name
        string avatarUrl
        string passwordHash "bcryptハッシュ（nullable）"
        boolean emailVerified "メールアドレス確認済みフラグ"
        string totpSecret "TOTP秘密鍵（AES-256-GCM暗号化、nullable）"
        boolean totpEnabled "2FA有効フラグ"
        int failedAttempts "ログイン失敗回数"
        timestamp lockedUntil "ロック解除日時"
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    Account {
        uuid id PK
        uuid userId FK
        string provider
        string providerAccountId
        string accessToken "AES-256-GCM暗号化"
        string refreshToken "AES-256-GCM暗号化"
        timestamp createdAt
        timestamp updatedAt
    }

    Session {
        uuid id PK
        uuid userId FK
        string tokenHash UK "SHA-256ハッシュ"
        string userAgent
        string ipAddress
        timestamp lastActiveAt
        timestamp expiresAt
        timestamp revokedAt
        timestamp createdAt
    }

    RefreshToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK "SHA-256ハッシュ"
        timestamp expiresAt
        timestamp revokedAt
        timestamp createdAt
    }

    PasswordResetToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK "SHA-256ハッシュ"
        timestamp expiresAt
        timestamp usedAt
        timestamp createdAt
    }

    EmailVerificationToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK "SHA-256ハッシュ"
        timestamp expiresAt
        timestamp usedAt
        timestamp createdAt
    }
```

## ビジネスルール

### トークン管理

- アクセストークンの有効期限は15分
- リフレッシュトークンの有効期限は7日
- トークン更新時、古いリフレッシュトークンは無効化される
- 無効化されたトークンは再利用不可

### セッション管理

- 複数デバイスからの同時ログインを許可
- セッションの有効期限は7日
- 認証済みリクエストのたびに最終アクセス時刻を更新
- セッション無効化時、関連するリフレッシュトークンも無効化

### パスワード認証

- パスワード要件: 8〜100文字、大文字・小文字・数字・記号を各1文字以上
- bcrypt でハッシュ化（コストファクター: 12）
- `passwordHash` は nullable（OAuthのみのユーザーは null）
- OAuthユーザーは後からパスワードを追加設定可能
- メールアドレスはトリミング + 小文字変換して保存

### アカウントロック

- 連続5回のログイン失敗でアカウントをロック
- ロック時間: 30分
- ロック解除後、失敗カウントはリセット
- タイミング攻撃対策: ユーザー不存在時もダミーハッシュと比較

### パスワードリセット

- リセットトークン: 32バイトのランダム値（hex形式）
- DB にはトークンの SHA-256 ハッシュのみ保存
- 有効期限: 1時間
- 使用済みトークンは再利用不可（`usedAt` でマーク）
- リセット実行時、全セッションを無効化
- `forgot-password` エンドポイントはユーザー不存在でも常に200を返す（メール存在確認防止）

### 2FA（TOTP）

- RFC 6238 準拠のTOTP認証
- 発行者: "Agentest"
- 時間ステップ: 30秒
- 桁数: 6桁
- TOTP秘密鍵はAES-256-GCMで暗号化してDB保存（`TOTP_ENCRYPTION_KEY`）
- セットアップ時の一時秘密鍵はRedisに保存（5分TTL）
- 2FA有効ユーザーのログイン時はJWTを発行せず、一時トークン（Redis, 5分TTL）を返却
- 2FA検証完了後に初めてJWTトークンペアを発行
- リプレイ攻撃対策: 使用済みTOTPコードをRedisに記録（90秒TTL）
- 2FA無効化にはパスワード確認が必要
- 全2FAイベントは監査ログに記録

#### 2FAレート制限

| エンドポイント | 制限 | 理由 |
|---------------|------|------|
| `/auth/2fa/setup` | 3回/分 | QRコード生成コスト |
| `/auth/2fa/enable` | 5回/分 | コード検証制限 |
| `/auth/2fa/verify` | 5回/分 | ブルートフォース対策（6桁=100万通り） |
| `/auth/2fa/disable` | 5回/分 | コード検証制限 |

### メールアドレス確認

- メール/パスワードで登録したユーザーは、メールアドレスの確認が完了するまでログイン不可
- `REQUIRE_EMAIL_VERIFICATION=false` でメール認証をスキップ可能（セルフホスト環境向け）
  - スキップ時は `emailVerified=true` で即ユーザー作成、JWT即発行でログイン完了
  - 確認メールは送信されない
  - 本番環境で `false` に設定すると警告ログを出力
- 確認トークン: 32バイトのランダム値（hex形式）
- DB にはトークンの SHA-256 ハッシュのみ保存
- 有効期限: 24時間
- 使用済みトークンは再利用不可（`usedAt` でマーク）
- OAuthユーザーは自動で `emailVerified=true`（メール確認不要）
- `resend-verification` エンドポイントはユーザー不存在・確認済みでも常に同じレスポンスを返す（メール存在確認防止）
- 再送信時、既存の未使用トークンを無効化して新トークンを生成

### OAuth連携

- 対応プロバイダー: GitHub、Google
- OAuthプロバイダーの有効/無効は環境変数で制御（`GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` が両方設定されている場合に有効）
- `GET /api/config` で利用可能なプロバイダー情報を公開（認証不要）
- 無効なプロバイダーはLogin/Register/Settingsの全画面でボタンが非表示
- 1ユーザーに複数プロバイダーを連携可能
- 同一メールアドレスの場合、既存ユーザーに連携追加
- 最低1つの認証方法が必須（パスワードが設定されていればOAuth連携を全解除可能）

### エラーハンドリング

| エラー | 対応 |
|--------|------|
| OAuth認証失敗 | ログイン画面へリダイレクト、エラー表示 |
| トークン期限切れ | リフレッシュ試行、失敗時はログイン画面へ |
| セッション無効 | ログイン画面へリダイレクト |
| 不正なトークン | 401エラー、ログイン画面へ |

## 設定値

| 項目 | 値 | 説明 |
|------|-----|------|
| JWT_ACCESS_EXPIRES_IN | 15m | アクセストークン有効期限 |
| JWT_REFRESH_EXPIRES_IN | 7d | リフレッシュトークン有効期限 |
| SESSION_EXPIRY | 7d | セッション有効期限 |
| TOKEN_ENCRYPTION_KEY | - | OAuthトークン暗号化キー（本番必須） |
| TOTP_ENCRYPTION_KEY | - | TOTP秘密鍵暗号化キー（AES-256-GCM、64文字hex） |
| REQUIRE_EMAIL_VERIFICATION | true | `false` でメール認証をスキップ（セルフホスト向け） |
| GITHUB_CLIENT_ID | - | GitHub OAuth クライアントID（未設定でGitHub認証無効） |
| GITHUB_CLIENT_SECRET | - | GitHub OAuth シークレット（未設定でGitHub認証無効） |
| GOOGLE_CLIENT_ID | - | Google OAuth クライアントID（未設定でGoogle認証無効） |
| GOOGLE_CLIENT_SECRET | - | Google OAuth シークレット（未設定でGoogle認証無効） |

## セキュリティ考慮事項

- **パスワード保護**
  - bcrypt 12ラウンドでハッシュ化
  - ブルートフォース対策: レート制限 + アカウントロック（5回失敗で30分ロック）
  - タイミング攻撃対策: ユーザー不存在時もダミーbcrypt比較を実行
  - パスワードリセットトークン: SHA-256ハッシュ化してDB保存、有効期限1時間、使い捨て
  - メール存在確認防止: forgot-password は常に同じレスポンスを返す
  - パスワードリセット時は全セッション無効化
  - パスワード変更時は現在のセッション以外を無効化
- **メールアドレス確認**
  - 確認トークン: SHA-256ハッシュ化してDB保存、有効期限24時間、使い捨て
  - メール確認完了まで JWT 未発行（ログインブロック）
  - 確認メール再送信: 既存トークン無効化 + 新トークン生成
  - メール存在確認防止: resend-verification は常に同じレスポンスを返す
- **2FA（TOTP）保護**
  - TOTP秘密鍵: AES-256-GCM暗号化保存（`TOTP_ENCRYPTION_KEY`）、DB漏洩時の2FAバイパスを防止
  - 暗号化形式: `iv:authTag:ciphertext`（毎回異なるIVでランダム性を確保）
  - 2FA有効ユーザーのログイン時: JWTを一切発行せず、一時トークン（Redis 5分TTL）のみ返却
  - 2FA検証完了前は全APIアクセス不可（サーバーサイドで完全に防止）
  - リプレイ攻撃対策: 使用済みTOTPコードをRedisに記録（90秒TTL）
  - ブルートフォース対策: レート制限（5回/分）
  - 一時トークン: 検証成功時に即削除、5分TTLで自動失効
  - 全2FAイベント（設定/有効化/検証/無効化）を監査ログに記録
- **Cookie設定**
  - HttpOnly: XSS対策
  - Secure: HTTPS必須（本番環境）
  - SameSite=Strict: CSRF対策
- **トークン保存**
  - アクセストークン: HttpOnly Cookie
  - リフレッシュトークン: HttpOnly Cookie
  - セッション・リフレッシュトークン: DB には SHA-256 ハッシュのみ保存（生トークンは Cookie にのみ保持）
  - クライアント側のJavaScriptからはアクセス不可
- **OAuthトークンの暗号化保存**
  - OAuthプロバイダー（GitHub/Google）から取得した accessToken / refreshToken は AES-256-GCM で暗号化してDB保存
  - 暗号化形式: `v1:iv:authTag:ciphertext`（バージョン付き、Base64エンコード、コロン区切り）
  - IV: 12バイトのランダム値（毎回生成）、AuthTag: 16バイト（改ざん検知）
  - 暗号化キーは環境変数 `TOKEN_ENCRYPTION_KEY` で管理
- **トークン署名**
  - アクセストークンとリフレッシュトークンで異なる秘密鍵を使用

## MCP OAuth 2.1 認証

MCPクライアント（Claude Code等）向けのOAuth 2.1認証フロー。

### 概要

- **APIサーバー**: Authorization Server（OAuth 2.1準拠）
- **MCPサーバー**: Resource Server（RFC 9728準拠）
- **クライアント登録**: Dynamic Client Registration（RFC 7591準拠）
- **PKCE**: S256のみサポート（plain禁止）
- **リソースインジケーター**: RFC 8707準拠

### MCP OAuth 2.1 認証フロー

```mermaid
sequenceDiagram
    participant C as Claude Code
    participant M as MCP Server
    participant A as API Server
    participant B as Browser
    participant U as User

    C->>M: POST /mcp (initialize)
    M->>C: 401 Unauthorized + WWW-Authenticate
    C->>M: GET /.well-known/oauth-protected-resource
    M->>C: Protected Resource Metadata
    C->>A: GET /.well-known/oauth-authorization-server
    A->>C: Authorization Server Metadata
    C->>A: POST /oauth/register
    A->>C: client_id
    C->>B: Open authorize URL
    B->>A: GET /oauth/authorize
    A->>B: Login/Consent screen
    U->>B: Approve
    B->>A: POST /oauth/authorize/consent
    A->>B: Redirect with code
    B->>C: code (via localhost callback)
    C->>A: POST /oauth/token (code + code_verifier)
    A->>C: access_token
    C->>M: POST /mcp (Authorization: Bearer token)
    M->>A: POST /oauth/introspect
    A->>M: Token info (active: true)
    M->>C: MCP response
```

### エンドポイント

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/.well-known/oauth-authorization-server` | GET | Authorization Server Metadata |
| `/oauth/register` | POST | 動的クライアント登録 |
| `/oauth/authorize` | GET | 認可エンドポイント |
| `/oauth/authorize/consent` | POST | 同意承認 |
| `/oauth/token` | POST | トークン発行 |
| `/oauth/introspect` | POST | トークン検証 |
| `/oauth/revoke` | POST | トークン失効 |

### トークン仕様（MCP OAuth 2.1）

| 種類 | 有効期限 | 保存方法 |
|-----|---------|---------|
| アクセストークン | 1時間 | SHA256ハッシュ化してDB保存 |
| 認可コード | 10分 | DB保存（使い捨て） |

### セキュリティ要件

- PKCE必須（S256のみ）
- リソースインジケーター（RFC 8707）でAudience検証
- redirect_uriはlocalhost/127.0.0.1のみ許可
- HTTPS必須（本番環境）

### データモデル（MCP OAuth 2.1）

```mermaid
erDiagram
    User ||--o{ OAuthAuthorizationCode : "has"
    User ||--o{ OAuthAccessToken : "has"
    OAuthClient ||--o{ OAuthAuthorizationCode : "issues"
    OAuthClient ||--o{ OAuthAccessToken : "issues"

    OAuthClient {
        uuid id PK
        string clientId UK
        string clientName
        array redirectUris
        array scopes
        boolean isActive
        timestamp createdAt
    }

    OAuthAuthorizationCode {
        uuid id PK
        string code UK
        string clientId FK
        uuid userId FK
        string codeChallenge
        string resource
        timestamp expiresAt
        timestamp usedAt
    }

    OAuthAccessToken {
        uuid id PK
        string tokenHash UK
        string clientId FK
        uuid userId FK
        array scopes
        string audience
        timestamp expiresAt
        timestamp revokedAt
    }
```

## APIキー認証

OAuth 2.1 に対応していない Coding Agent（Claude Code 等）向けの API キー認証機能。

### 概要

- **対象**: MCP サーバーへのアクセス
- **ヘッダー**: `X-API-Key` ヘッダーを使用
- **権限**: フルアクセス（ユーザーと同等の権限）
- **フォーマット**: `agentest_<32バイトのBase64URL>`

### 認証優先順位（ハイブリッド認証）

MCP サーバーでは以下の優先順位で認証を行う：

1. **OAuth Bearer Token** - `Authorization: Bearer <token>` があれば OAuth 2.1 認証
2. **API キー** - `X-API-Key: agentest_...` があれば API キー認証
3. **Cookie JWT** - 上記がなければ Cookie 認証（フォールバック）

### APIキー管理画面

- **URL**: `/settings`（API キータブ）
- **表示要素**
  - API キー一覧（名前、プレフィックス、作成日、最終使用日、有効期限）
  - 「新規作成」ボタン
  - 各キーの「失効」ボタン
- **操作**
  - 新規作成 → 名前と有効期限を入力 → 生成されたトークンを表示（1回のみ）
  - 失効 → 確認ダイアログ → 即時無効化

### APIキー認証フロー

```mermaid
sequenceDiagram
    participant C as Claude Code
    participant M as MCP Server
    participant A as API Server
    participant DB as Database

    C->>M: POST /mcp (X-API-Key: agentest_xxx)
    M->>M: プレフィックス検証 (agentest_)
    M->>A: POST /internal/api/api-token/validate
    A->>A: SHA-256ハッシュ化
    A->>DB: トークン検索 (ハッシュ照合)
    A->>A: 有効性検証 (期限、失効、ユーザー状態)
    A->>M: { valid: true, userId, scopes }
    M->>M: req.user, req.authType 設定
    M->>C: MCP response
```

### セキュリティ考慮事項

- **ハッシュ保存**: 生トークンは保存せず、SHA-256 ハッシュのみ保存
- **1回限りの表示**: 作成直後の 1 回のみ生トークンを返却
- **最終使用日時**: トークン使用時に自動更新（不正利用検知に活用）
- **即時失効**: 失効操作で即座に無効化

### 使用例（Claude Code 設定）

```json
{
  "mcpServers": {
    "agentest": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "X-API-Key": "agentest_xxxxxxxxxxxxx",
        "X-MCP-Client-Id": "claude-code-user123",
        "X-MCP-Project-Id": "project-uuid"
      }
    }
  }
}
```

## 管理者認証機能

管理者（システム運営者）向けの認証機能。ユーザー認証とは完全に独立したセッション管理を提供。

### 機能一覧

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ADM-AUTH-001 | 管理者ログイン | メール/パスワードでログイン | 実装済 |
| ADM-AUTH-002 | 管理者ログアウト | セッションを終了 | 実装済 |
| ADM-AUTH-003 | 2FA セットアップ | TOTP 認証の設定 | 実装済 |
| ADM-AUTH-004 | 2FA 検証 | ログイン時の 2FA 検証 | 実装済 |
| ADM-AUTH-005 | セッション延長 | セッション有効期限を延長 | 実装済 |
| ADM-AUTH-006 | アカウントロック | 失敗回数超過でロック | 実装済 |
| ADM-AUTH-007 | パスワードリセット要求 | リセット用メールを送信（メール列挙防止対応） | 実装済 |
| ADM-AUTH-008 | パスワードリセット実行 | トークンを使用して新しいパスワードを設定 | 実装済 |

### 管理者ログインフロー

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
    alt 認証成功 & 2FA無効
        B->>DB: セッション作成
        B->>F: Cookie設定 + ユーザー情報
        F->>A: ダッシュボードへリダイレクト
    else 認証成功 & 2FA有効
        B->>F: requiresTwoFactor: true + tempToken
        F->>A: 2FA入力画面表示
        A->>F: TOTPコード入力
        F->>B: POST /admin/auth/2fa/verify
        B->>DB: TOTPコード検証
        B->>DB: セッション作成
        B->>F: Cookie設定 + ユーザー情報
        F->>A: ダッシュボードへリダイレクト
    else 認証失敗
        B->>DB: 失敗回数インクリメント
        alt 5回以上失敗
            B->>DB: アカウントロック
        end
        B->>F: エラーレスポンス
        F->>A: エラーメッセージ表示
    end
```

### 2FA セットアップフロー

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
        B->>F: 成功レスポンス
        F->>A: 有効化完了メッセージ
    else 検証失敗
        B->>F: エラーレスポンス
        F->>A: エラーメッセージ（再試行）
    end
```

### 管理者パスワードリセットフロー

```mermaid
sequenceDiagram
    participant A as 管理者
    participant F as Admin App
    participant B as API
    participant DB as データベース
    participant Mail as メールサービス

    A->>F: パスワードリセット画面アクセス
    F->>A: メールアドレス入力フォーム表示
    A->>F: メールアドレス入力
    F->>B: POST /admin/auth/password-reset/request
    B->>DB: メールアドレスでユーザー検索

    alt ユーザーが存在
        B->>B: リセットトークン生成（32バイトランダム）
        B->>DB: 既存の未使用トークンを無効化
        B->>DB: トークンハッシュ保存（SHA-256、有効期限1時間）
        B->>DB: 監査ログ記録（PASSWORD_RESET_REQUESTED）
        B->>Mail: リセットメール送信
    end

    B->>F: 200 送信しました（常に同じレスポンス）
    F->>A: 送信完了メッセージ表示

    Note over A,Mail: 管理者がメールのリンクをクリック

    A->>F: /reset-password/:token にアクセス
    F->>A: 新しいパスワード入力フォーム表示
    A->>F: 新しいパスワード入力
    F->>B: POST /admin/auth/password-reset/reset

    B->>DB: トークンハッシュで検索・検証
    alt トークンが無効または期限切れ
        B->>F: 400 ADMIN_INVALID_RESET_TOKEN
        F->>A: エラーメッセージ表示
    else トークンが有効
        B->>B: bcryptでパスワードハッシュ化
        B->>DB: パスワード更新 + 失敗回数リセット + ロック解除
        B->>DB: トークンを使用済みにマーク
        B->>DB: 全セッション無効化
        B->>DB: 監査ログ記録（PASSWORD_RESET_COMPLETED）
        B->>F: 200 リセット成功
        F->>A: 完了メッセージ + ログイン画面へのリンク
    end
```

### 管理者認証データモデル

```mermaid
erDiagram
    AdminUser ||--o{ AdminSession : "has"
    AdminUser ||--o{ AdminAuditLog : "has"
    AdminUser ||--o{ AdminPasswordResetToken : "has"

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
        string token_hash UK "SHA-256ハッシュ"
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

    AdminPasswordResetToken {
        uuid id PK
        uuid admin_user_id FK
        string token_hash UK
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }
```

### 管理者認証ビジネスルール

#### パスワード要件

- 最小文字数: 8文字
- 複雑性: 大文字、小文字、数字、記号のうち3種類以上
- bcrypt でハッシュ化（コストファクター: 12）

#### アカウントロック

- 連続5回のログイン失敗でアカウントをロック
- ロック時間: 30分
- ロック解除後、失敗カウントはリセット

#### セッション管理

- 有効期限: 8時間
- 非アクティブタイムアウト: 30分
- セッショントークン: 32バイトの暗号的に安全なランダム値
- DB には SHA-256 ハッシュのみ保存（生トークンは Cookie にのみ保持）

#### パスワードリセット

- リセットトークン: 32バイトのランダム値（hex形式）
- DB にはトークンの SHA-256 ハッシュのみ保存
- 有効期限: 1時間
- 使用済みトークンは再利用不可（`usedAt` でマーク）
- 新規発行時、同一ユーザーの既存未使用トークンを無効化
- リセット実行時、全セッションを無効化
- リセット実行時、失敗回数リセットとアカウントロック解除を同時実行
- リセット要求はユーザー不存在でも常に同じレスポンスを返す（メール列挙防止）

#### 2FA（TOTP）

- RFC 6238 準拠
- 発行者: "Agentest Admin"
- 時間ステップ: 30秒
- 桁数: 6桁

### 管理者認証セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| パスワード | bcrypt ハッシュ化、複雑性要件 |
| ブルートフォース | レート制限、アカウントロック |
| セッションハイジャック | HttpOnly Cookie、Secure、SameSite=Strict |
| TOTP シークレット | AES-256-GCM 暗号化保存 |
| 監査証跡 | 全認証イベントをログ記録 |
| パスワードリセット | トークンSHA-256ハッシュ保存、1時間有効、1回限り使用 |
| リセット時全セッション無効化 | パスワードリセット成功時に全セッションを無効化 |
| メール列挙防止 | リセット要求は存在しないメールでも同一レスポンスを返す |

## 関連機能

- [ユーザー管理](./user-management.md) - OAuth連携の追加・解除
- [監査ログ](./audit-log.md) - ログイン履歴の記録
- [MCP連携](./mcp-integration.md) - MCP認証フローの詳細
- [OAuth 2.1 API](../../api/oauth.md) - APIリファレンス
- [OAuth 2.1データベース設計](../database/oauth.md) - テーブル定義
- [APIトークン データベース設計](../database/api-token.md) - APIトークンテーブル定義
- [認証 API](../../api/auth.md) - APIキー管理エンドポイント
- [管理者認証 API](../../api/admin-auth.md) - 管理者認証エンドポイント
- [管理者認証データベース設計](../database/admin-auth.md) - 管理者認証テーブル定義
