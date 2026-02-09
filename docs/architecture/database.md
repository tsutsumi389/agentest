# データベース設計

詳細なテーブル定義は [database/](./database/index.md) ディレクトリを参照してください。

## テーブル一覧

### 認証関連

| テーブル | 説明 |
|---------|------|
| [User](./database/auth.md#user) | ユーザー情報（パスワードハッシュ、ロック情報を含む） |
| [Account](./database/auth.md#account) | OAuth アカウント（GitHub, Google） |
| [RefreshToken](./database/auth.md#refreshtoken) | JWT リフレッシュトークン |
| [Session](./database/auth.md#session) | ユーザーセッション |
| [PasswordResetToken](./database/auth.md#passwordresettoken) | パスワードリセットトークン |

### OAuth 2.1（MCP クライアント向け）

| テーブル | 説明 |
|---------|------|
| [OAuthClient](./database/oauth.md#oauthclient) | 動的登録クライアント（RFC 7591） |
| [OAuthAuthorizationCode](./database/oauth.md#oauthauthorizationcode) | 認可コード（PKCE 対応） |
| [OAuthAccessToken](./database/oauth.md#oauthaccesstoken) | アクセストークン |

### 組織・プロジェクト

| テーブル | 説明 |
|---------|------|
| [Organization](./database/organization.md#organization) | 組織（チーム） |
| [OrganizationMember](./database/organization.md#organizationmember) | 組織メンバー（多対多） |
| [Project](./database/organization.md#project) | プロジェクト |
| [ProjectEnvironment](./database/organization.md#projectenvironment) | プロジェクトの環境設定（dev/stg/prod等） |
| [ProjectHistory](./database/organization.md#projecthistory) | プロジェクトの変更履歴 |

### Agent セッション

| テーブル | 説明 |
|---------|------|
| [AgentSession](./database/agent-session.md#agentsession) | Coding Agent のセッション管理 |

### テストスイート

| テーブル | 説明 |
|---------|------|
| [TestSuite](./database/test-suite.md#testsuite) | テストスイート |
| [TestSuitePrecondition](./database/test-suite.md#testsuiteprecondition) | テストスイートの前提条件 |
| [TestSuiteHistory](./database/test-suite.md#testsuitehistory) | テストスイートの変更履歴 |

### テストケース

| テーブル | 説明 |
|---------|------|
| [TestCase](./database/test-case.md#testcase) | テストケース |
| [TestCasePrecondition](./database/test-case.md#testcaseprecondition) | テストケースの前提条件 |
| [TestCaseStep](./database/test-case.md#testcasestep) | テストケースの手順 |
| [TestCaseExpectedResult](./database/test-case.md#testcaseexpectedresult) | テストケースの期待値 |
| [TestCaseHistory](./database/test-case.md#testcasehistory) | テストケースの変更履歴 |

### テスト実行

| テーブル | 説明 |
|---------|------|
| [Execution](./database/execution.md#execution) | テスト実行 |
| [ExecutionSnapshot](./database/execution.md#executionsnapshot) | 実行時のスナップショット |
| [ExecutionPreconditionResult](./database/execution.md#executionpreconditionresult) | 前提条件の確認結果 |
| [ExecutionStepResult](./database/execution.md#executionstepresult) | 手順の実施結果 |
| [ExecutionExpectedResult](./database/execution.md#executionexpectedresult) | 期待値の判定結果 |
| [ExecutionEvidence](./database/execution.md#executionevidence) | エビデンス（添付ファイル） |

### レビュー

| テーブル | 説明 |
|---------|------|
| [ReviewComment](./database/review.md#reviewcomment) | レビューコメント（詳細項目対応） |
| [ReviewCommentReply](./database/review.md#reviewcommentreply) | レビューコメントへの返信 |

### 同時編集制御

| テーブル | 説明 |
|---------|------|
| [EditLock](./database/edit-lock.md#editlock) | 編集ロック管理 |

## マイグレーション

```bash
# マイグレーション作成
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name <name>

# マイグレーション適用（本番）
docker compose exec api pnpm --filter @agentest/db prisma migrate deploy
```

## 関連ドキュメント

- [データベース設計詳細](./database/index.md)
- [システム全体像](./overview.md)
- [API 設計方針](./api-design.md)
