#!/bin/bash
# シークレットにプレースホルダー値を投入するスクリプト
#
# 必須シークレットには "placeholder" を、オプションシークレットには空文字を投入します。
# OAuth のトグルは truthy チェック（env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET）のため、
# オプションシークレットに "placeholder" を入れると意図せず有効化されてしまいます。
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

# 必須シークレット: サービス起動に必要。placeholder 値で初期化後、update-secrets.sh で実値を設定
REQUIRED_SECRETS=(
  DATABASE_URL
  REDIS_URL
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  INTERNAL_API_SECRET
  TOKEN_ENCRYPTION_KEY
  TOTP_ENCRYPTION_KEY
)

# オプションシークレット: 使用する機能に応じて設定。空文字で初期化（truthy チェック対策）
OPTIONAL_SECRETS=(
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  SMTP_USER
  SMTP_PASS
)

echo "=== 必須シークレットの初期化（placeholder） ==="
for SECRET in "${REQUIRED_SECRETS[@]}"; do
  echo "Setting ${SECRET_PREFIX}-${SECRET}..."
  echo -n "placeholder" | gcloud secrets versions add "${SECRET_PREFIX}-${SECRET}" \
    --project="${PROJECT_ID}" --data-file=-
done

echo ""
echo "=== オプションシークレットの初期化（空文字） ==="
for SECRET in "${OPTIONAL_SECRETS[@]}"; do
  echo "Setting ${SECRET_PREFIX}-${SECRET} (empty)..."
  printf '' | gcloud secrets versions add "${SECRET_PREFIX}-${SECRET}" \
    --project="${PROJECT_ID}" --data-file=- 2>/dev/null || \
  printf ' ' | gcloud secrets versions add "${SECRET_PREFIX}-${SECRET}" \
    --project="${PROJECT_ID}" --data-file=-
done

echo ""
echo "Done!"
echo ""
echo "次のステップ:"
echo "  1. update-secrets.sh で必須シークレット（DB接続、JWT キー等）を設定"
echo "  2. OAuth や SMTP を使用する場合は update-secrets.sh で対話的に設定"
