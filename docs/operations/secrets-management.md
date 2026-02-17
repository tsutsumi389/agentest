# 環境変数・シークレット管理ガイド

最終更新日: 2025年12月

## 1. 概要

本ドキュメントは、Agentestにおける環境変数とシークレット（機密情報）の管理方法を説明します。

## 2. 環境変数の分類

| 分類 | 例 | 保存場所 |
|------|-----|---------|
| 設定値 | `NODE_ENV`, `PORT` | `.env`、環境変数 |
| 非機密シークレット | `API_BASE_URL` | `.env`、ConfigMap |
| 機密シークレット | `JWT_SECRET`, `DB_PASSWORD` | Secret Manager |
| 資格情報 | OAuth Client Secret | Secret Manager |

## 3. ローカル開発環境

### 3.1 .env ファイル構成

```bash
# .env.example をコピーして .env を作成
cp .env.example .env
```

**.env.example**:
```bash
# ===========================================
# アプリケーション設定
# ===========================================
NODE_ENV=development
LOG_LEVEL=debug

# ===========================================
# データベース
# ===========================================
DB_USER=agentest
DB_PASSWORD=agentest
DB_NAME=agentest
DB_HOST=db
DB_PORT=5432
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# ===========================================
# Redis
# ===========================================
REDIS_PASSWORD=agentest
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ===========================================
# MinIO (S3互換ストレージ)
# ===========================================
MINIO_ROOT_USER=agentest
MINIO_ROOT_PASSWORD=agentest123
S3_ENDPOINT=http://minio:9000
S3_BUCKET=evidence

# ===========================================
# 認証
# ===========================================
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OAuth - GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback

# OAuth - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# ===========================================
# フロントエンド
# ===========================================
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
```

### 3.2 環境別ファイル

```
.env              # ローカル開発（Git管理外）
.env.example      # テンプレート（Git管理）
.env.test         # テスト用（Git管理外）
```

### 3.3 Git での除外設定

**.gitignore**:
```
.env
.env.local
.env.*.local
.env.test
!.env.example
```

## 4. 本番環境（Cloud）

### 4.1 Secret Manager

```bash
# シークレット作成
echo -n "super-secret-value" | \
  gcloud secrets create JWT_SECRET --data-file=-

# シークレット更新（新バージョン）
echo -n "new-secret-value" | \
  gcloud secrets versions add JWT_SECRET --data-file=-

# シークレット確認
gcloud secrets versions access latest --secret=JWT_SECRET

# シークレット一覧
gcloud secrets list
```

### 4.2 Cloud Run での参照

```bash
# シークレットを環境変数として設定
gcloud run services update agentest-api \
  --set-secrets=JWT_SECRET=JWT_SECRET:latest \
  --set-secrets=DB_PASSWORD=DB_PASSWORD:latest

# 複数シークレット
gcloud run services update agentest-api \
  --set-secrets="
    JWT_SECRET=JWT_SECRET:latest,
    DB_PASSWORD=DB_PASSWORD:latest,
    GITHUB_CLIENT_SECRET=GITHUB_CLIENT_SECRET:latest,
    TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest
  "
```

### 4.3 シークレット一覧

| シークレット名 | 用途 | ローテーション |
|---------------|------|---------------|
| `JWT_SECRET` | JWTトークン署名 | 年次 |
| `DB_PASSWORD` | DB接続 | 年次 |
| `REDIS_PASSWORD` | Redis接続 | 年次 |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | 必要時 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | 必要時 |
| `MINIO_ROOT_PASSWORD` | MinIO管理者 | 年次 |
| `TOKEN_ENCRYPTION_KEY` | OAuthトークン暗号化（AES-256-GCM） | 年次 |
| `SENTRY_DSN` | エラー監視 | - |

## 5. シークレットのローテーション

### 5.1 JWT シークレットのローテーション

```bash
# 1. 新しいシークレットを生成
NEW_SECRET=$(openssl rand -base64 32)

# 2. Secret Manager に追加
echo -n "$NEW_SECRET" | \
  gcloud secrets versions add JWT_SECRET --data-file=-

# 3. アプリケーションを再デプロイ
gcloud run services update agentest-api \
  --set-secrets=JWT_SECRET=JWT_SECRET:latest

# 4. 古いセッションは期限切れを待つ
# 5. 古いバージョンを無効化
gcloud secrets versions disable VERSION_ID --secret=JWT_SECRET
```

### 5.2 TOKEN_ENCRYPTION_KEY のローテーション

> **注意**: 暗号化キーを変更すると、既存の暗号化済みOAuthトークンが復号できなくなります。ローテーション時はマイグレーションスクリプトで既存トークンを再暗号化してください。

```bash
# 1. 新しい暗号化キーを生成
NEW_KEY=$(openssl rand -base64 32)

# 2. Secret Manager に追加
echo -n "$NEW_KEY" | \
  gcloud secrets versions add TOKEN_ENCRYPTION_KEY --data-file=-

# 3. マイグレーションスクリプトで既存トークンを再暗号化
#    （旧キーで復号 → 新キーで暗号化）

# 4. アプリケーションを再デプロイ
gcloud run services update agentest-api \
  --set-secrets=TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest

# 5. 古いバージョンを無効化
gcloud secrets versions disable VERSION_ID --secret=TOKEN_ENCRYPTION_KEY
```

### 5.3 DB パスワードのローテーション

```bash
# 1. 新しいパスワードを生成
NEW_PASSWORD=$(openssl rand -base64 24)

# 2. Cloud SQL でパスワード変更
gcloud sql users set-password agentest \
  --instance=agentest-db \
  --password="$NEW_PASSWORD"

# 3. Secret Manager を更新
echo -n "$NEW_PASSWORD" | \
  gcloud secrets versions add DB_PASSWORD --data-file=-

# 4. アプリケーションを再デプロイ
gcloud run services update agentest-api \
  --set-secrets=DB_PASSWORD=DB_PASSWORD:latest
```

## 6. 環境変数のバリデーション

### 6.1 Zod スキーマによる検証

```typescript
// packages/shared/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  // アプリケーション
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // データベース
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // 認証
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // トークン暗号化
  TOKEN_ENCRYPTION_KEY: z.string().min(32),

  // ストレージ
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string(),
});

export type Env = z.infer<typeof envSchema>;

// バリデーション実行
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

### 6.2 アプリケーション起動時の検証

```typescript
// apps/api/src/config/env.ts
import { validateEnv } from '@agentest/shared';

export const env = validateEnv();

// 使用例
console.log(`Starting on port ${env.PORT}`);
```

## 7. Terraform による管理

### 7.1 シークレットの定義

```hcl
# infrastructure/terraform/secrets.tf

# シークレットの作成
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "JWT_SECRET"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# 初期バージョン（手動で値を設定）
resource "google_secret_manager_secret_version" "jwt_secret_version" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret  # tfvars または環境変数から
}

# Cloud Run からのアクセス許可
resource "google_secret_manager_secret_iam_member" "jwt_secret_access" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}
```

### 7.2 Cloud Run への設定

```hcl
# infrastructure/terraform/cloudrun.tf

resource "google_cloud_run_service" "api" {
  name     = "agentest-api"
  location = var.region

  template {
    spec {
      containers {
        image = var.api_image

        env {
          name  = "NODE_ENV"
          value = var.environment
        }

        env {
          name = "JWT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.jwt_secret.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.database_url.secret_id
              key  = "latest"
            }
          }
        }
      }
    }
  }
}
```

## 8. CI/CD でのシークレット管理

### 8.1 GitHub Actions Secrets

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy agentest-api \
            --image=${{ secrets.GCR_REGISTRY }}/agentest-api:${{ github.sha }}
```

### 8.2 シークレットの設定方法

```bash
# GitHub CLI でシークレット設定
gh secret set GCP_SA_KEY < service-account.json
gh secret set GCR_REGISTRY --body "gcr.io/my-project"

# 確認
gh secret list
```

## 9. セキュリティベストプラクティス

### 9.1 やるべきこと

- シークレットは Secret Manager で管理
- 環境変数はアプリ起動時にバリデーション
- 定期的なシークレットローテーション
- 最小権限の原則でアクセス制御
- 監査ログの有効化

### 9.2 やってはいけないこと

- シークレットをソースコードにハードコード
- シークレットをログに出力
- シークレットを平文でファイル保存
- シークレットをGitにコミット
- 本番シークレットを開発環境で使用

### 9.3 シークレット漏洩時の対応

```bash
# 1. 漏洩したシークレットを即座に無効化
gcloud secrets versions disable VERSION_ID --secret=LEAKED_SECRET

# 2. 新しいシークレットを生成
NEW_SECRET=$(openssl rand -base64 32)

# 3. Secret Manager を更新
echo -n "$NEW_SECRET" | \
  gcloud secrets versions add LEAKED_SECRET --data-file=-

# 4. アプリケーションを再デプロイ

# 5. 影響調査（監査ログ確認）
gcloud logging read "resource.type=secret_manager"
```

## 10. トラブルシューティング

### シークレットが読み込めない

```bash
# 権限確認
gcloud secrets get-iam-policy JWT_SECRET

# サービスアカウントに権限付与
gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

### 環境変数が反映されない

```bash
# Cloud Run の環境変数確認
gcloud run services describe agentest-api \
  --format="yaml(spec.template.spec.containers[0].env)"

# 再デプロイで強制更新
gcloud run services update agentest-api --no-traffic
gcloud run services update agentest-api --traffic 100
```

---

## 関連ドキュメント

- [セキュリティ対策](./security.md)
- [デプロイ手順](../guides/deployment.md)
- [インシデント対応](./incident-response.md)
