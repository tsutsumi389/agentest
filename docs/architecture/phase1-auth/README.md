# Phase 1: 認証基盤 詳細設計書

## 概要

Phase 1 では、システムの土台となるユーザー認証機能を構築する。OAuth 2.0 による GitHub / Google ログイン、JWT によるセッション管理、プロフィール設定機能を提供する。

## 機能一覧

| 機能 ID | 機能名 | 説明 | 状態 |
|---------|--------|------|------|
| USR-001 | ユーザー登録 | GitHub / Google OAuth でアカウント作成 | 実装済 |
| AU-001 | OAuth 認証 | GitHub / Google OAuth ログイン | 実装済 |
| USR-002 | プロフィール設定 | 表示名、アバター、メール設定 | 実装済 |
| USR-003 | OAuth 連携追加 | 既存アカウントに別プロバイダーを追加 | 実装済 |
| USR-004 | OAuth 連携解除 | 連携済みプロバイダーの解除 | 実装済 |
| USR-005 | セッション管理 | アクティブセッションの確認・無効化 | 実装済 |
| USR-006 | アカウント削除 | 自身のアカウントを論理削除 | 実装済 |

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  pages/            │  stores/         │  lib/                   │
│  ├─ Login.tsx      │  └─ auth.ts      │  └─ api.ts              │
│  ├─ Settings.tsx   │     (Zustand)    │     (API Client)        │
│  └─ AuthCallback   │                  │                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP (Cookie-based Auth)
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                        │
├─────────────────────────────────────────────────────────────────┤
│  routes/           │  controllers/    │  services/              │
│  ├─ auth.ts        │  ├─ auth         │  ├─ auth                │
│  ├─ users.ts       │  ├─ user         │  ├─ user                │
│  └─ sessions.ts    │  └─ session      │  ├─ session             │
│                    │                  │  └─ account             │
├─────────────────────────────────────────────────────────────────┤
│  middleware/       │  repositories/   │  packages/auth/         │
│  └─ session        │  ├─ user         │  ├─ jwt.ts              │
│                    │  ├─ session      │  ├─ passport.ts         │
│                    │  └─ account      │  └─ middleware.ts       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Prisma ORM
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                               │
├─────────────────────────────────────────────────────────────────┤
│  User │ Account │ Session │ RefreshToken                        │
└─────────────────────────────────────────────────────────────────┘
```

## 認証フロー

### OAuth ログインフロー

```
ユーザー          Frontend           Backend            OAuth Provider
   │                 │                  │                     │
   │  1. ログインボタン │                  │                     │
   │─────────────────>│                  │                     │
   │                 │  2. リダイレクト   │                     │
   │                 │─────────────────>│                     │
   │                 │                  │  3. OAuth 開始       │
   │                 │                  │────────────────────>│
   │                 │                  │                     │
   │  4. 認可画面     │                  │                     │
   │<─────────────────────────────────────────────────────────│
   │                 │                  │                     │
   │  5. 認可        │                  │                     │
   │─────────────────────────────────────────────────────────>│
   │                 │                  │                     │
   │                 │                  │  6. コールバック      │
   │                 │                  │<────────────────────│
   │                 │                  │                     │
   │                 │                  │  7. ユーザー作成/取得 │
   │                 │                  │  8. JWT 発行        │
   │                 │                  │  9. Session 作成    │
   │                 │                  │                     │
   │                 │ 10. Cookie設定    │                     │
   │                 │<─────────────────│                     │
   │                 │                  │                     │
   │ 11. /auth/callback へリダイレクト    │                     │
   │<────────────────│                  │                     │
   │                 │                  │                     │
   │                 │ 12. /api/auth/me │                     │
   │                 │─────────────────>│                     │
   │                 │                  │                     │
   │                 │ 13. ユーザー情報   │                     │
   │                 │<─────────────────│                     │
   │                 │                  │                     │
   │ 14. Dashboard   │                  │                     │
   │<────────────────│                  │                     │
```

### セッション管理フロー

```
ユーザー          Frontend           Backend            Database
   │                 │                  │                  │
   │  アクセス        │                  │                  │
   │─────────────────>│                  │                  │
   │                 │  Cookie付きリクエスト│                  │
   │                 │─────────────────>│                  │
   │                 │                  │  セッション検証   │
   │                 │                  │─────────────────>│
   │                 │                  │                  │
   │                 │                  │  lastActiveAt更新 │
   │                 │                  │─────────────────>│
   │                 │                  │                  │
   │                 │  レスポンス       │                  │
   │                 │<─────────────────│                  │
```

## ディレクトリ構成

### Backend

```
apps/api/src/
├── config/
│   ├── auth.ts              # 認証設定
│   └── env.ts               # 環境変数
├── controllers/
│   ├── auth.controller.ts   # OAuth・トークン管理
│   ├── user.controller.ts   # ユーザー CRUD
│   └── session.controller.ts # セッション管理
├── services/
│   ├── auth.service.ts      # 認証ビジネスロジック
│   ├── user.service.ts      # ユーザービジネスロジック
│   ├── session.service.ts   # セッションビジネスロジック
│   └── account.service.ts   # OAuth連携ビジネスロジック
├── repositories/
│   ├── user.repository.ts   # ユーザー DB 操作
│   ├── session.repository.ts # セッション DB 操作
│   └── account.repository.ts # OAuth連携 DB 操作
├── routes/
│   ├── auth.ts              # 認証ルート
│   ├── users.ts             # ユーザールート
│   └── sessions.ts          # セッションルート
└── middleware/
    └── session.middleware.ts # セッション追跡

packages/auth/src/
├── jwt.ts                   # JWT 生成・検証
├── passport.ts              # Passport 設定
├── middleware.ts            # 認証ミドルウェア
├── config.ts                # 認証パッケージ設定
└── types.ts                 # 型定義
```

### Frontend

```
apps/web/src/
├── pages/
│   ├── Login.tsx            # ログインページ
│   ├── Settings.tsx         # 設定ページ（プロフィール・セキュリティ）
│   └── AuthCallback.tsx     # OAuth コールバック
├── stores/
│   ├── auth.ts              # 認証ストア（Zustand）
│   └── toast.ts             # トースト通知ストア
├── hooks/
│   └── useAuth.ts           # 認証フック
├── lib/
│   └── api.ts               # API クライアント
└── components/
    ├── Layout.tsx           # レイアウト（ナビゲーション含む）
    ├── Toast.tsx            # トースト通知
    └── ErrorBoundary.tsx    # エラーバウンダリ
```

## 関連ドキュメント

### 詳細設計

| ドキュメント | 内容 |
|-------------|------|
| [バックエンド詳細設計](./backend.md) | コントローラ・サービス・リポジトリの詳細 |
| [フロントエンド詳細設計](./frontend.md) | コンポーネント・ストア・API クライアントの詳細 |
| [セキュリティ設計](./security.md) | JWT・Cookie・認可の詳細 |

### API リファレンス

| ドキュメント | 内容 |
|-------------|------|
| [認証 API](../../api/auth.md) | OAuth・トークン管理 API |
| [ユーザー API](../../api/users.md) | ユーザー CRUD API |
| [セッション API](../../api/sessions.md) | セッション管理 API |
| [OAuth 連携 API](../../api/accounts.md) | OAuth 連携管理 API |

### データモデル

| ドキュメント | 内容 |
|-------------|------|
| [認証関連テーブル](../database/auth.md) | User・Account・Session・RefreshToken |

## 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `JWT_ACCESS_SECRET` | Yes | - | アクセストークン署名キー（32文字以上） |
| `JWT_REFRESH_SECRET` | Yes | - | リフレッシュトークン署名キー（32文字以上） |
| `JWT_ACCESS_EXPIRES_IN` | No | 15m | アクセストークン有効期限 |
| `JWT_REFRESH_EXPIRES_IN` | No | 7d | リフレッシュトークン有効期限 |
| `GITHUB_CLIENT_ID` | No | - | GitHub OAuth クライアント ID |
| `GITHUB_CLIENT_SECRET` | No | - | GitHub OAuth クライアントシークレット |
| `GITHUB_CALLBACK_URL` | No | http://localhost:3001/auth/github/callback | GitHub OAuth コールバック URL |
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth クライアントシークレット |
| `GOOGLE_CALLBACK_URL` | No | http://localhost:3001/auth/google/callback | Google OAuth コールバック URL |
| `CORS_ORIGIN` | No | http://localhost:3000 | CORS 許可オリジン |

## 今後の拡張予定

- [ ] Remember Me 機能（30日セッション）
- [ ] メールアドレス変更機能
- [ ] 2要素認証（TOTP）
- [ ] 監査ログ記録
