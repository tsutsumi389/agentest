#!/usr/bin/env bash
# Stop: エージェント完了時にリント＋型チェックを実行
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

# リントチェック実行
lint_output=$(npx eslint --no-error-on-unmatched-pattern $changed_files 2>&1) || {
  echo "リントエラーがあります。修正してから完了してください:" >&2
  echo "$lint_output" | tail -20 >&2
  exit 1
}
