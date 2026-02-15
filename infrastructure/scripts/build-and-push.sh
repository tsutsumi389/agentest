#!/bin/bash
# 全サービスのDockerイメージをビルドしてArtifact Registryにプッシュするスクリプト
# プッシュ後、ダイジェストを取得して terraform.tfvars のイメージを自動更新する
set -e

REGISTRY="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker"
TAG="latest"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TFVARS_FILE="${SCRIPT_DIR}/../terraform/environments/staging/terraform.tfvars"

# プロジェクトルートに移動（Docker ビルドコンテキストとして使用）
cd "${SCRIPT_DIR}/../.."

# フロントエンドのビルド時環境変数
VITE_API_URL="https://app.staging.agentest.jp"
VITE_WS_URL="wss://app.staging.agentest.jp"

# Cloud Run 互換のイメージをビルド・プッシュするヘルパー関数
# --provenance=false --sbom=false で OCI image index 形式を回避
build_and_push() {
  local name="$1"
  local dockerfile="$2"
  shift 2
  local extra_args=("$@")

  docker buildx build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    --push \
    -t "${REGISTRY}/${name}:${TAG}" \
    -f "${dockerfile}" \
    "${extra_args[@]}" \
    .
}

# プッシュ済みイメージのダイジェストを取得するヘルパー関数
get_digest() {
  local name="$1"
  gcloud artifacts docker images describe \
    "${REGISTRY}/${name}:${TAG}" \
    --format='get(image_summary.digest)' \
    --project=agentest-staging
}

echo "=== Artifact Registry への認証 ==="
gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet

echo ""
echo "=== API サーバー ==="
build_and_push "api" "docker/Dockerfile.api"
API_DIGEST=$(get_digest "api")
echo "  digest: ${API_DIGEST}"

echo ""
echo "=== WebSocket サーバー ==="
build_and_push "ws" "docker/Dockerfile.ws"
WS_DIGEST=$(get_digest "ws")
echo "  digest: ${WS_DIGEST}"

echo ""
echo "=== MCP サーバー ==="
build_and_push "mcp" "docker/Dockerfile.mcp"
MCP_DIGEST=$(get_digest "mcp")
echo "  digest: ${MCP_DIGEST}"

echo ""
echo "=== Web フロントエンド ==="
build_and_push "web" "docker/Dockerfile.web" \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  --build-arg "VITE_WS_URL=${VITE_WS_URL}"
WEB_DIGEST=$(get_digest "web")
echo "  digest: ${WEB_DIGEST}"

echo ""
echo "=== Admin フロントエンド ==="
build_and_push "admin" "docker/Dockerfile.admin" \
  --build-arg "VITE_API_URL=${VITE_API_URL}"
ADMIN_DIGEST=$(get_digest "admin")
echo "  digest: ${ADMIN_DIGEST}"

echo ""
echo "=== バッチジョブ ==="
build_and_push "jobs" "apps/jobs/Dockerfile"
JOBS_DIGEST=$(get_digest "jobs")
echo "  digest: ${JOBS_DIGEST}"

echo ""
echo "=== terraform.tfvars のイメージを更新 ==="
if [ -f "${TFVARS_FILE}" ]; then
  # 各イメージ変数をダイジェスト付きURIに置換
  sed -i '' "s|^api_image.*|api_image   = \"${REGISTRY}/api@${API_DIGEST}\"|" "${TFVARS_FILE}"
  sed -i '' "s|^ws_image.*|ws_image    = \"${REGISTRY}/ws@${WS_DIGEST}\"|" "${TFVARS_FILE}"
  sed -i '' "s|^mcp_image.*|mcp_image   = \"${REGISTRY}/mcp@${MCP_DIGEST}\"|" "${TFVARS_FILE}"
  sed -i '' "s|^web_image.*|web_image   = \"${REGISTRY}/web@${WEB_DIGEST}\"|" "${TFVARS_FILE}"
  sed -i '' "s|^admin_image.*|admin_image = \"${REGISTRY}/admin@${ADMIN_DIGEST}\"|" "${TFVARS_FILE}"
  sed -i '' "s|^jobs_image.*|jobs_image  = \"${REGISTRY}/jobs@${JOBS_DIGEST}\"|" "${TFVARS_FILE}"
  echo "terraform.tfvars を更新しました"
else
  echo "WARNING: ${TFVARS_FILE} が見つかりません"
  echo "以下の値で terraform.tfvars を手動更新してください:"
fi

echo ""
echo "=== 完了 ==="
echo "全イメージをプッシュしました。"
echo ""
echo "イメージダイジェスト:"
echo "  api_image   = \"${REGISTRY}/api@${API_DIGEST}\""
echo "  ws_image    = \"${REGISTRY}/ws@${WS_DIGEST}\""
echo "  mcp_image   = \"${REGISTRY}/mcp@${MCP_DIGEST}\""
echo "  web_image   = \"${REGISTRY}/web@${WEB_DIGEST}\""
echo "  admin_image = \"${REGISTRY}/admin@${ADMIN_DIGEST}\""
echo "  jobs_image  = \"${REGISTRY}/jobs@${JOBS_DIGEST}\""
echo ""
echo "次のステップ:"
echo "  1. terraform apply:  cd infrastructure/terraform/environments/staging && terraform apply"
echo "  2. DB マイグレーション: gcloud run jobs execute agentest-db-migrate-staging --region asia-northeast1 --wait"
echo "  3. サービス確認:     curl https://app.staging.agentest.jp/health"
