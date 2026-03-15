#!/usr/bin/env bash
# PreToolUse: 破壊的操作とリンター設定変更をブロック
set -euo pipefail
input="$(cat)"
tool="$(jq -r '.tool_name // empty' <<< "$input")"

# Bashコマンドの破壊的操作チェック
if [ "$tool" = "Bash" ]; then
  cmd="$(jq -r '.tool_input.command // empty' <<< "$input")"
  if echo "$cmd" | grep -qE '(rm -rf|drop table|git push --force|git reset --hard|git checkout \.)'; then
    echo "BLOCKED: 破壊的コマンドは禁止されています。安全な代替手段を使ってください。" >&2
    exit 2
  fi
fi

# ファイル編集系ツールのリンター設定保護
if [ "$tool" = "Edit" ] || [ "$tool" = "Write" ]; then
  file="$(jq -r '.tool_input.file_path // empty' <<< "$input")"

  # リンター・ビルド設定の変更ブロック
  if echo "$file" | grep -qE '(eslint\.config|\.prettierrc|tsconfig\.json|biome\.json)'; then
    echo "BLOCKED: リンター/ビルド設定の変更は禁止です。コードを修正してください。" >&2
    exit 2
  fi

  # 機密ファイルの編集ブロック
  if echo "$file" | grep -qE '\.(env|pem|key)$'; then
    echo "BLOCKED: 機密ファイルの編集は禁止されています。" >&2
    exit 2
  fi
fi
