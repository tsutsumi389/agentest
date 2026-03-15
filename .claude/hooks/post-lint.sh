#!/usr/bin/env bash
# PostToolUse: Biome自動フォーマット + oxlintチェック
set -euo pipefail

input="$(cat)"
file="$(jq -r '.tool_input.file_path // empty' <<< "$input")"

# JS/TSファイルのみ対象
case "$file" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# ファイルが存在しない場合はスキップ
[ -f "$file" ] || exit 0

messages=""

# Phase 1: Biomeで自動フォーマット（サイレント）
pnpm exec biome format --write "$file" >/dev/null 2>&1 || true

# Phase 2: oxlintチェック（高速リント）
diag="$(pnpm exec oxlint "$file" 2>&1 | head -20)" || true
if [ -n "$diag" ] && echo "$diag" | grep -qE '(error|warning)\['; then
  messages="${messages}oxlint違反:\n${diag}\n"
fi

# 結果をadditionalContextとして返す
if [ -n "$messages" ]; then
  jq -Rn --arg msg "$messages" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: $msg
    }
  }'
fi
