#!/bin/bash
# シークレット値を更新するスクリプト
set -e

PROJECT_ID="agentest-staging"
PREFIX="agentest-staging"

# ============================================
# ここを書き換えてください
# ============================================
DB_PASSWORD="ここにterraform.tfvarsのdatabase_passwordを入力"
# ============================================

# DB接続情報
DATABASE_URL="postgresql://agentest:${DB_PASSWORD}@10.46.1.3:5432/agentest"

# Redis接続情報
REDIS_AUTH="ここにRedisの認証文字列を入力（gcloud redis instances get-auth-string で取得）"
REDIS_URL="redis://:${REDIS_AUTH}@10.46.0.3:6379"

# JWT/暗号化キー（ランダム生成）
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
INTERNAL_API_SECRET=$(openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "=== 必須シークレットを更新 ==="

update_secret() {
  local name=$1
  local value=$2
  echo "Updating ${PREFIX}-${name}..."
  echo -n "${value}" | gcloud secrets versions add "${PREFIX}-${name}" --project="${PROJECT_ID}" --data-file=-
}

update_secret "DATABASE_URL" "${DATABASE_URL}"
update_secret "REDIS_URL" "${REDIS_URL}"
update_secret "JWT_ACCESS_SECRET" "${JWT_ACCESS_SECRET}"
update_secret "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET}"
update_secret "INTERNAL_API_SECRET" "${INTERNAL_API_SECRET}"
update_secret "TOKEN_ENCRYPTION_KEY" "${TOKEN_ENCRYPTION_KEY}"
update_secret "TOTP_ENCRYPTION_KEY" "${TOTP_ENCRYPTION_KEY}"

echo ""
echo "=== 完了 ==="
echo "以下のシークレットは各サービスの準備ができたら別途設定してください："
echo "  - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET （GitHub OAuth）"
echo "  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET （Google OAuth）"
echo "  - STRIPE_* （Stripe決済）"
echo "  - SMTP_USER / SMTP_PASS （メール送信）"
