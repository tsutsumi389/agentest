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

echo ""
echo "WARNING: このスクリプトは JWT/暗号化キーを新規生成して上書きします。"
echo "既にサービスが稼働中の場合、既存のセッションやトークンが無効化されます。"
echo ""
read -p "続行しますか？ (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "中止しました"
  exit 0
fi

# JWT/暗号化キー（ランダム生成）
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
INTERNAL_API_SECRET=$(openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)

update_secret() {
  local name=$1
  local value=$2
  echo "Updating ${SECRET_PREFIX}-${name}..."
  echo -n "${value}" | gcloud secrets versions add "${SECRET_PREFIX}-${name}" --project="${PROJECT_ID}" --data-file=-
}

echo ""
echo "=== 必須シークレットを更新 ==="

update_secret "DATABASE_URL" "${DATABASE_URL}"
update_secret "REDIS_URL" "${REDIS_URL}"
update_secret "JWT_ACCESS_SECRET" "${JWT_ACCESS_SECRET}"
update_secret "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET}"
update_secret "INTERNAL_API_SECRET" "${INTERNAL_API_SECRET}"
update_secret "TOKEN_ENCRYPTION_KEY" "${TOKEN_ENCRYPTION_KEY}"
update_secret "TOTP_ENCRYPTION_KEY" "${TOTP_ENCRYPTION_KEY}"

echo ""
echo "=== オプションシークレットの設定 ==="
echo ""

# --- GitHub OAuth ---
read -p "GitHub OAuth を設定しますか？ (y/N): " setup_github
if [[ "$setup_github" == "y" || "$setup_github" == "Y" ]]; then
  read -p "  GITHUB_CLIENT_ID: " github_client_id
  read -sp "  GITHUB_CLIENT_SECRET: " github_client_secret
  echo
  if [[ -n "$github_client_id" && -n "$github_client_secret" ]]; then
    update_secret "GITHUB_CLIENT_ID" "${github_client_id}"
    update_secret "GITHUB_CLIENT_SECRET" "${github_client_secret}"
    echo "  GitHub OAuth を設定しました"
  else
    echo "  スキップ（値が空です）"
  fi
fi

# --- Google OAuth ---
read -p "Google OAuth を設定しますか？ (y/N): " setup_google
if [[ "$setup_google" == "y" || "$setup_google" == "Y" ]]; then
  read -p "  GOOGLE_CLIENT_ID: " google_client_id
  read -sp "  GOOGLE_CLIENT_SECRET: " google_client_secret
  echo
  if [[ -n "$google_client_id" && -n "$google_client_secret" ]]; then
    update_secret "GOOGLE_CLIENT_ID" "${google_client_id}"
    update_secret "GOOGLE_CLIENT_SECRET" "${google_client_secret}"
    echo "  Google OAuth を設定しました"
  else
    echo "  スキップ（値が空です）"
  fi
fi

# --- SMTP ---
read -p "SMTP（メール送信）を設定しますか？ (y/N): " setup_smtp
if [[ "$setup_smtp" == "y" || "$setup_smtp" == "Y" ]]; then
  read -p "  SMTP_USER: " smtp_user
  read -sp "  SMTP_PASS: " smtp_pass
  echo
  if [[ -n "$smtp_user" && -n "$smtp_pass" ]]; then
    update_secret "SMTP_USER" "${smtp_user}"
    update_secret "SMTP_PASS" "${smtp_pass}"
    echo "  SMTP を設定しました"
  else
    echo "  スキップ（値が空です）"
  fi
fi

echo ""
echo "=== 完了 ==="
echo ""
echo "オプションシークレットは後からでも以下のコマンドで個別に設定できます:"
echo "  echo -n 'VALUE' | gcloud secrets versions add ${SECRET_PREFIX}-SECRET_NAME --project=${PROJECT_ID} --data-file=-"
