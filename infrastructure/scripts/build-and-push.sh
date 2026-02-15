#!/bin/bash
# 全サービスのDockerイメージをビルドしてArtifact Registryにプッシュするスクリプト
set -e

REGISTRY="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker"
TAG="latest"

# フロントエンドのビルド時環境変数
VITE_API_URL="https://app.staging.agentest.jp"
VITE_WS_URL="wss://app.staging.agentest.jp"

echo "=== Artifact Registry への認証 ==="
gcloud auth configure-docker asia-northeast1-docker.pkg.dev --quiet

echo ""
echo "=== API サーバー ==="
docker build --platform linux/amd64 --provenance=false -t "${REGISTRY}/api:${TAG}" -f docker/Dockerfile.api .
docker push "${REGISTRY}/api:${TAG}"

echo ""
echo "=== WebSocket サーバー ==="
docker build --platform linux/amd64 --provenance=false -t "${REGISTRY}/ws:${TAG}" -f docker/Dockerfile.ws .
docker push "${REGISTRY}/ws:${TAG}"

echo ""
echo "=== MCP サーバー ==="
docker build --platform linux/amd64 --provenance=false -t "${REGISTRY}/mcp:${TAG}" -f docker/Dockerfile.mcp .
docker push "${REGISTRY}/mcp:${TAG}"

echo ""
echo "=== Web フロントエンド ==="
docker build --platform linux/amd64 --provenance=false -t "${REGISTRY}/web:${TAG}" -f docker/Dockerfile.web \
  --build-arg VITE_API_URL="${VITE_API_URL}" \
  --build-arg VITE_WS_URL="${VITE_WS_URL}" .
docker push "${REGISTRY}/web:${TAG}"

echo ""
echo "=== Admin フロントエンド ==="
docker build --platform linux/amd64 --provenance=false -t "${REGISTRY}/admin:${TAG}" -f docker/Dockerfile.admin \
  --build-arg VITE_API_URL="${VITE_API_URL}" .
docker push "${REGISTRY}/admin:${TAG}"

echo ""
echo "=== バッチジョブ ==="
docker build --platform linux/amd64 --provenance=false -t "${REGISTRY}/jobs:${TAG}" -f apps/jobs/Dockerfile .
docker push "${REGISTRY}/jobs:${TAG}"

echo ""
echo "=== 完了 ==="
echo "全イメージをプッシュしました。"
echo ""
echo "terraform.tfvars のイメージを以下に更新してください:"
echo "  api_image   = \"${REGISTRY}/api:${TAG}\""
echo "  ws_image    = \"${REGISTRY}/ws:${TAG}\""
echo "  mcp_image   = \"${REGISTRY}/mcp:${TAG}\""
echo "  web_image   = \"${REGISTRY}/web:${TAG}\""
echo "  admin_image = \"${REGISTRY}/admin:${TAG}\""
echo "  jobs_image  = \"${REGISTRY}/jobs:${TAG}\""
