# Hooks設計ガイド

Claude Code Hooksはハーネスの最大の差別化要素。ツール実行の前後に決定論的制御を挿入する。

## 4つのHookパターン

### 1. Safety Gates（PreToolUse）

破壊的操作を機械的にブロック。exit 2でブロック、stderrの理由がエージェントにフィードバック。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/safety-gate.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail
input="$(cat)"
cmd="$(jq -r '.tool_input.command // empty' <<< "$input")"

# 破壊的コマンドブロック
if echo "$cmd" | grep -qE '(rm -rf|drop table|git push --force|git reset --hard)'; then
  echo "BLOCKED: 破壊的コマンドは禁止されています" >&2
  exit 2
fi

# 機密ファイル編集ブロック
file="$(jq -r '.tool_input.file_path // empty' <<< "$input")"
if echo "$file" | grep -qE '\.(env|pem|key)$'; then
  echo "BLOCKED: 機密ファイルの編集は禁止されています" >&2
  exit 2
fi
```

### 2. Quality Loops（PostToolUse）

ファイル編集後にリンター・フォーマッター自動実行。結果をadditionalContextとして注入し、エージェント自己修正を駆動。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/post-lint.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"
file="$(jq -r '.tool_input.file_path // .tool_input.path // empty' <<< "$input")"

case "$file" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# Phase 1: 自動修正（サイレント）- 40-50%の問題を解消
npx biome format --write "$file" >/dev/null 2>&1 || true
npx oxlint --fix "$file" >/dev/null 2>&1 || true

# Phase 2: 残った違反をadditionalContextとして返す
diag="$(npx oxlint "$file" 2>&1 | head -20)"

if [ -n "$diag" ]; then
  jq -Rn --arg msg "$diag" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: $msg
    }
  }'
fi
```

要点：
- 自動修正を先に実行（biome format → oxlint --fix）
- 残った違反だけをJSON形式で返す
- エージェントは返されたcontextを見て自己修正

### 3. Completion Gates（Stop）

エージェント完了宣言時にテスト実行。テスト通過までブロック。

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/stop-gate.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail

# 無限ループ防止フラグ
if [ "${STOP_HOOK_ACTIVE:-}" = "1" ]; then
  exit 0
fi
export STOP_HOOK_ACTIVE=1

# テスト実行
test_output=$(pnpm test 2>&1) || {
  echo "テストが失敗しています。修正してください:" >&2
  echo "$test_output" | tail -30 >&2
  exit 1
}
```

### 4. Observability（全イベント）

PreToolUseでエージェント意図監視、PostToolUseで結果監視、PreCompactで失われるコンテキスト監視。

## リンター設定保護

エージェントがリンターエラーに直面した際、コード修正ではなく設定変更でエラーを消すケースが頻出。

```bash
# PreToolUse hookで設定ファイル編集をブロック
#!/usr/bin/env bash
set -euo pipefail
input="$(cat)"
file="$(jq -r '.tool_input.file_path // empty' <<< "$input")"

PROTECTED_PATTERNS="eslint.config|biome.json|pyproject.toml|.prettierrc|tsconfig.json"
if echo "$file" | grep -qE "$PROTECTED_PATTERNS"; then
  echo "BLOCKED: リンター/ビルド設定の変更は禁止です。コードを修正してください。" >&2
  exit 2
fi
```

## 「ほぼ毎回」vs「例外なく毎回」

CLAUDE.mdに「リンターを実行せよ」と書く → ほぼ毎回実行される
PostToolUse Hookでリンター実行 → 例外なく毎回実行される

セッション47回目の長いデバッグチェーンでコンテキスト大半を消費後、エージェントはファイルを書いて次に進む。リンターは忘れ去られる。Hookは忘れない。
