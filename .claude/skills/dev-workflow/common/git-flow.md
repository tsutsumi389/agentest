# Git Flow

## Branch Strategy

GitHub Flow をベースにしたシンプルな運用。

```
main (production)
  └── feature/xxx
  └── fix/xxx
  └── refactor/xxx
```

### Branch Naming

```
{type}/{issue-number}-{short-description}
```

| Type | Usage |
|------|-------|
| `feature` | 新機能追加 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `docs` | ドキュメントのみの変更 |
| `test` | テストの追加・修正 |
| `chore` | ビルド、CI/CD、依存関係更新 |

**Examples:**

```
feature/123-user-authentication
fix/456-login-validation-error
refactor/789-extract-user-service
```

## Commit Messages

Conventional Commits 形式を使用。

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `style` | フォーマット（機能に影響なし） |
| `refactor` | リファクタリング |
| `test` | テスト追加・修正 |
| `chore` | ビルド、CI等 |

### Scope

影響範囲を示す（任意）:

- `auth`, `user`, `test-case`, `api`, `db`, etc.

### Examples

```bash
# 機能追加
feat(auth): implement JWT authentication

Add login endpoint with JWT token generation.
Includes refresh token support.

Closes #123

# バグ修正
fix(user): resolve email validation error

Email regex was not handling + symbol correctly.

Fixes #456

# リファクタリング
refactor(test-case): extract validation logic

Move validation to separate module for reusability.
```

## Workflow

### 1. Start Work

```bash
git checkout main
git pull origin main
git checkout -b feature/123-new-feature
```

### 2. Development

```bash
# 作業中は細かくコミット
git add .
git commit -m "feat(scope): work in progress"

# 必要に応じてrebase
git fetch origin
git rebase origin/main
```

### 3. Before PR

```bash
# コミットを整理（squash/reword）
git rebase -i origin/main

# 最新のmainを取り込む
git fetch origin
git rebase origin/main
```

### 4. Human Review

コミット前に人間がレビュー:

1. `git diff` で変更内容を確認
2. `git log --oneline` でコミット履歴を確認
3. 問題なければ push を承認

```bash
# レビュー後にpush
git push origin feature/123-new-feature
```

### 5. Pull Request

PR作成時の必須項目:

- [ ] タイトル: Conventional Commits 形式
- [ ] 説明: 変更内容、影響範囲、テスト方法
- [ ] 関連Issue: `Closes #123`
- [ ] レビュワー指定（該当する場合）

### 6. Merge

- Squash merge を推奨
- マージ後はローカルブランチを削除

```bash
git checkout main
git pull origin main
git branch -d feature/123-new-feature
```

## Protected Branch Rules

`main` ブランチ:

- 直接pushは禁止
- PR経由でのみマージ
- CI通過必須
