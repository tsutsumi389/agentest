#!/usr/bin/env bash
# PostToolUse: Prettier自動フォーマット + ESLint + console.logチェック
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

# Phase 1: Prettierで自動フォーマット（サイレント）
npx prettier --write "$file" >/dev/null 2>&1 || true

# Phase 2: console.logチェック
if grep -n 'console\.log' "$file" | grep -v '//.*console\.log' | head -5 | grep -q .; then
  consoleLogs=$(grep -n 'console\.log' "$file" | grep -v '//.*console\.log' | head -5)
  messages="${messages}WARNING: console.logが検出されました。本番コードでは適切なロガーを使用してください:\n${consoleLogs}\n"
fi

# Phase 3: ESLintチェック（残った違反のみ報告）
diag="$(npx eslint --no-error-on-unmatched-pattern --format compact "$file" 2>&1 | head -20)" || true
if [ -n "$diag" ] && ! echo "$diag" | grep -q "^$"; then
  messages="${messages}ESLint違反:\n${diag}\n"
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
