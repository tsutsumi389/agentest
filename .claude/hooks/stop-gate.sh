#!/usr/bin/env bash
# Stop: エージェント完了時にリント＋テスト検証を実行
set -euo pipefail

# 無限ループ防止
if [ "${STOP_HOOK_ACTIVE:-}" = "1" ]; then
  exit 0
fi
export STOP_HOOK_ACTIVE=1

# 変更されたTS/TSXファイルがあるか確認
changed_files=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
if [ -z "$changed_files" ]; then
  # ステージされたファイルも確認
  changed_files=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
fi

# 変更ファイルがなければスキップ
if [ -z "$changed_files" ]; then
  exit 0
fi

# リントチェック実行（oxlint）
lint_output=$(pnpm exec oxlint $changed_files 2>&1) || {
  echo "リントエラーがあります。修正してから完了してください:" >&2
  echo "$lint_output" | tail -20 >&2
  exit 1
}

# テスト検証: 変更されたファイルに関連するテストを実行
# Dockerコンテナが起動していない場合はスキップ
if ! docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml ps --status running 2>/dev/null | grep -q "dev"; then
  echo "⚠ Dockerコンテナ未起動のためテスト検証をスキップ" >&2
  exit 0
fi

# 変更されたパッケージを特定してテスト実行
changed_packages=$(echo "$changed_files" | sed -n 's|^\(apps/[^/]*\)/.*|\1|p;s|^\(packages/[^/]*\)/.*|\1|p' | sort -u)

if [ -n "$changed_packages" ]; then
  # turboのフィルタでスコープ指定テスト
  filters=""
  for pkg_dir in $changed_packages; do
    pkg_name=$(node -e "try{console.log(require('./${pkg_dir}/package.json').name)}catch{}" 2>/dev/null || true)
    if [ -n "$pkg_name" ]; then
      filters="$filters --filter=$pkg_name"
    fi
  done

  if [ -n "$filters" ]; then
    test_output=$(docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml exec -T dev pnpm turbo run test --concurrency=1 $filters 2>&1) || {
      echo "テストが失敗しています。修正してから完了してください:" >&2
      echo "$test_output" | tail -30 >&2
      exit 1
    }
  fi
fi
