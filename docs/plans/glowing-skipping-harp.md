# OAuth機能トグル・メール認証省略に伴うインフラ設定の更新

## Context

OAuth機能トグル（PR #241）とメール認証省略オプションの実装により、APIの環境変数構成が変わった。インフラ側（Terraform、スクリプト、ドキュメント）を同期させる必要がある。

**具体的な問題:**
1. `REQUIRE_EMAIL_VERIFICATION` 環境変数が Cloud Run API に未設定
2. SMTP 非シークレット設定（`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_SECURE`）が Cloud Run に未設定
3. `init-secrets.sh` が全シークレットに `"placeholder"` を設定するが、OAuthのトグルは `env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET` の truthy チェック → `"placeholder"` だとOAuth有効と誤判定されて認証エラーになる

## 変更対象ファイル

| ファイル | 変更種別 |
|---------|---------|
| `infrastructure/terraform/environments/example/variables.tf` | 変数追加 |
| `infrastructure/terraform/environments/example/main.tf` | env_vars追加 |
| `infrastructure/terraform/environments/example/terraform.tfvars.example` | ドキュメント追加 |
| `infrastructure/scripts/init-secrets.sh` | 必須/任意シークレットの分離 |
| `infrastructure/scripts/update-secrets.sh` | オプションシークレットの対話的設定追加 |
| `infrastructure/terraform/README.md` | シークレット表の必須/任意分離、環境変数セクション追加 |
| `infrastructure/README.md` | デプロイガイドに新変数・SMTP無し手順を追加 |

---

## Step 1: Terraform 変数追加

**`environments/example/variables.tf`** に以下を追加:
- `require_email_verification` (string, default "true")
- `smtp_host` (string, default "")
- `smtp_port` (number, default 587)
- `smtp_from` (string, default "noreply@agentest.local")
- `smtp_secure` (string, default "true")

## Step 2: Cloud Run API の env_vars 追加

**`environments/example/main.tf`** の `cloud_run_api` モジュール `env_vars` に追加:
```hcl
REQUIRE_EMAIL_VERIFICATION = var.require_email_verification
SMTP_HOST                  = var.smtp_host
SMTP_PORT                  = tostring(var.smtp_port)
SMTP_FROM                  = var.smtp_from
SMTP_SECURE                = var.smtp_secure
```

## Step 3: terraform.tfvars.example 更新

**`environments/example/terraform.tfvars.example`** にアプリケーション設定セクション追加:
- `require_email_verification` / SMTP設定のドキュメント付きテンプレート

## Step 4: init-secrets.sh の修正（重要）

**問題:** 現在は全13シークレットに `"placeholder"` を投入。OAuth のトグルは `env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET` の truthy チェックなので `"placeholder"` だと有効と誤判定される。

**対応:** 必須シークレット（7個）に `"placeholder"` 、オプションシークレット（6個）に空文字を投入するように分離。

- **必須**: DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, INTERNAL_API_SECRET, TOKEN_ENCRYPTION_KEY, TOTP_ENCRYPTION_KEY
- **オプション**: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SMTP_USER, SMTP_PASS

## Step 5: update-secrets.sh の改善

オプションシークレット（OAuth/SMTP）の対話的設定プロンプトを追加。
現在の「後で手動設定してください」のメッセージを対話的フローに置換。

## Step 6: ドキュメント更新

**`terraform/README.md`:**
- シークレット表を「必須（7個）」と「オプション（6個）」に分離
- 環境変数（非シークレット）セクション追加

**`infrastructure/README.md`:**
- Step 4 に新変数の説明追加
- Step 6 にオプションシークレットの説明改善
- 「SMTP なしでデプロイする場合」のセクション追加

---

## 検証

```bash
# Terraform バリデーション
cd infrastructure/terraform/environments/example
terraform init -backend=false
terraform validate

# 新変数がすべて反映されていることを確認
grep -c "REQUIRE_EMAIL_VERIFICATION\|SMTP_HOST\|SMTP_PORT\|SMTP_FROM\|SMTP_SECURE" \
  infrastructure/terraform/environments/example/main.tf
# → 5

# init-secrets.sh でオプションシークレットが空文字であることを確認
grep -A2 "OPTIONAL_SECRETS" infrastructure/scripts/init-secrets.sh
```
