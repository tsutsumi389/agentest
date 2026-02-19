#!/bin/bash
# シークレット値を更新するスクリプト
#
# 必須環境変数:
#   PROJECT_ID    - GCP プロジェクト ID
#   DATABASE_URL  - PostgreSQL 接続 URL
#   REDIS_URL     - Redis 接続 URL
#
# オプション環境変数:
#   PREFIX      - リソース名のプレフィックス（デフォルト: agentest）
#   ENVIRONMENT - 環境名（デフォルト: production）
set -e

PROJECT_ID="${PROJECT_ID:?PROJECT_ID 環境変数を設定してください}"
PREFIX="${PREFIX:-agentest}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL 環境変数を設定してください}"
REDIS_URL="${REDIS_URL:?REDIS_URL 環境変数を設定してください}"

SECRET_PREFIX="${PREFIX}-${ENVIRONMENT}"

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
  echo "Updating ${SECRET_PREFIX}-${name}..."
  echo -n "${value}" | gcloud secrets versions add "${SECRET_PREFIX}-${name}" --project="${PROJECT_ID}" --data-file=-
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
echo "  - SMTP_USER / SMTP_PASS （メール送信）"
