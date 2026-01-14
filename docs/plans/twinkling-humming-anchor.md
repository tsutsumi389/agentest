# ローカルネットワーク接続対応 & 環境変数整理

## 概要

ローカルIPアドレスで別PCから接続可能にし、環境変数を整理する。

---

## Part 1: ローカルネットワーク接続対応

### 修正箇所

#### 1. `apps/admin/vite.config.ts`
- `host: true` を追加（0.0.0.0でバインド）

```typescript
server: {
  port: 3002,
  host: true,  // 追加
  proxy: { ... }
}
```

#### 2. `.env` のURL設定
ローカルネットワークからアクセスする場合、以下の変数を開発マシンのIPアドレスに変更：

```bash
# 開発マシンのIP: 192.168.1.42
API_URL=http://192.168.1.42:3001
WEB_URL=http://192.168.1.42:3000
ADMIN_URL=http://192.168.1.42:3003
WS_URL=ws://192.168.1.42:3002
MCP_SERVER_URL=http://192.168.1.42:3004

VITE_API_URL=http://192.168.1.42:3001
VITE_WS_URL=ws://192.168.1.42:3002

CORS_ORIGIN=http://192.168.1.42:3000,http://192.168.1.42:3003

# OAuth callbackはlocalhostのままにする（プロバイダー登録と一致させる必要があるため）
```

**注意**: OAuth認証（GitHub/Google）はコールバックURLがプロバイダーに登録されたURLと一致する必要があるため、ローカルネットワークテスト時はOAuth認証が動作しない。

---

## Part 2: 環境変数の整理

### 1. `docker/.env` を削除

**理由**: docker-compose.ymlは `../.env`（プロジェクトルート）を参照しており、`docker/.env` は使用されていない重複ファイル。

### 2. JWT変数名の統一

**現状の問題**:
- `.env`: `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`
- `apps/api/src/config/env.ts`: `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`

変数名が一致していないため、.envの値が読み込まれず、コードのデフォルト値が使用されている。

**修正**:
| ファイル | 変更内容 |
|---------|---------|
| `.env` | `JWT_ACCESS_EXPIRY` → `JWT_ACCESS_EXPIRES_IN` |
| `.env` | `JWT_REFRESH_EXPIRY` → `JWT_REFRESH_EXPIRES_IN` |
| `.env.example` | 同上 |

### 3. 重複変数の統合

| 削除する変数 | 残す変数 | 理由 |
|-------------|---------|------|
| `MCP_URL` | `MCP_SERVER_URL` | 同じ値、OAuth 2.1仕様で使用 |
| `AUTH_SERVER_URL` | `API_URL` | 同じサーバーを指す |

**修正対象ファイル**:
- `.env` - 重複変数を削除
- `.env.example` - 重複変数を削除
- `apps/mcp-server/src/config/env.ts` - `AUTH_SERVER_URL` → `API_URL` に変更

### 4. 不足変数の追加

`.env` に `CORS_ORIGIN` を追加：
```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:3003
```

### 5. 外部ポート変数の削除

`WEB_EXTERNAL_PORT`, `ADMIN_EXTERNAL_PORT` を `.env` と `.env.example` から削除する。

**理由**:
- docker-compose.override.ymlではデフォルト値（3000/3003）が設定されており、現在もデフォルト値で動作している
- `.env`の値（3004/3005）は実際には使用されていない
- 削除してもデフォルト値が使われるため、動作に影響なし

---

## 修正ファイル一覧

| ファイル | 修正内容 |
|---------|---------|
| `apps/admin/vite.config.ts` | `host: true` 追加 |
| `.env` | JWT変数名統一、CORS_ORIGIN追加、重複変数削除 |
| `.env.example` | JWT変数名統一、重複変数削除 |
| `docker/.env` | **削除** |
| `apps/mcp-server/src/config/env.ts` | AUTH_SERVER_URLの参照をAPI_URLに変更（検討） |

---

## 整理後の.env構成

```bash
# ===========================================
# Agentest Environment Variables
# ===========================================

NODE_ENV=development

# Database
DB_USER=agentest
DB_PASSWORD=agentest
DB_NAME=agentest
DB_HOST=db
DB_PORT=5432
DB_EXTERNAL_PORT=5433
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Redis
REDIS_PASSWORD=agentest
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_EXTERNAL_PORT=6380
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}

# MinIO
MINIO_ROOT_USER=agentest
MINIO_ROOT_PASSWORD=agentest123
MINIO_ENDPOINT=http://minio:9000
MINIO_API_EXTERNAL_PORT=9002
MINIO_CONSOLE_EXTERNAL_PORT=9003
MINIO_BUCKET=agentest

# JWT (変数名を統一)
JWT_ACCESS_SECRET=your-access-token-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-token-secret-change-in-production
JWT_ACCESS_EXPIRES_IN=15m    # 旧: JWT_ACCESS_EXPIRY
JWT_REFRESH_EXPIRES_IN=7d    # 旧: JWT_REFRESH_EXPIRY

# 内部API認証
INTERNAL_API_SECRET=development-internal-api-secret-32ch

# OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Application URLs (ローカルネットワーク時はlocalhostをIPに変更)
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
ADMIN_URL=http://localhost:3003
WS_URL=ws://localhost:3002
MCP_SERVER_URL=http://localhost:3004
# 削除: MCP_URL (MCP_SERVER_URLに統合)
# 削除: AUTH_SERVER_URL (API_URLを使用)

# Frontend (Vite)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002

# Ports
API_PORT=3001
WS_PORT=3002
WEB_PORT=3000
ADMIN_PORT=3003
# 削除: WEB_EXTERNAL_PORT, ADMIN_EXTERNAL_PORT (docker-compose.override.ymlのデフォルト値を使用)

# CORS (追加)
CORS_ORIGIN=http://localhost:3000,http://localhost:3003

# Logging
LOG_LEVEL=debug
```

---

## 検証方法

1. Docker再起動
```bash
cd docker && docker compose down && docker compose up
```

2. ローカルIPアドレスで各サービスにアクセス
```
Web:   http://<IP>:3004
API:   http://<IP>:3001
Admin: http://<IP>:3005
WS:    ws://<IP>:3002
MCP:   http://<IP>:3004
```

3. 別PCのブラウザからアクセスして動作確認
