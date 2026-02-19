#!/bin/bash
# シークレットにプレースホルダー値を投入するスクリプト
#
# 必須環境変数:
#   PROJECT_ID  - GCP プロジェクト ID
#
# オプション環境変数:
#   PREFIX      - リソース名のプレフィックス（デフォルト: agentest）
#   ENVIRONMENT - 環境名（デフォルト: production）
set -e

PROJECT_ID="${PROJECT_ID:?PROJECT_ID 環境変数を設定してください}"
PREFIX="${PREFIX:-agentest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

SECRET_PREFIX="${PREFIX}-${ENVIRONMENT}"

SECRETS=(
  DATABASE_URL
  REDIS_URL
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  INTERNAL_API_SECRET
  TOKEN_ENCRYPTION_KEY
  TOTP_ENCRYPTION_KEY
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  SMTP_USER
  SMTP_PASS
)

for SECRET in "${SECRETS[@]}"; do
  echo "Setting ${SECRET_PREFIX}-${SECRET}..."
  echo "placeholder" | gcloud secrets versions add "${SECRET_PREFIX}-${SECRET}" \
    --project="${PROJECT_ID}" --data-file=-
done

echo "Done!"
