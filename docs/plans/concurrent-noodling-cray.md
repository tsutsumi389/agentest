# apps/api ユニットテスト改善計画

## 現状サマリー

- **既存テスト**: 140ファイル（ユニット93 + 統合47）、約2,700テストケース
- **テスト品質**: 8.5/10（高品質だが特定領域にギャップあり）
- **目標**: 各機能の全レイヤー（Repository → Service → Controller）にユニットテストを整備

---

## フェーズ1: セキュリティ・認可（優先度: CRITICAL）

認可はアプリ全体の基盤。セキュリティ上の欠陥が致命的。

### 1.1 `authorization.service.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/authorization.service.test.ts`
- **対象**: `checkProjectRole(userId, projectId, requiredRoles)` 1メソッド
- **テスト数**: ~12
- **テスト内容**:
  - プロジェクト直接メンバー（ロール一致/OWNER/不足）
  - 組織メンバー経由（OWNER/ADMIN許可、MEMBER拒否）
  - プロジェクト不在・組織なしの場合
- **モック**: `prisma.projectMember`, `prisma.project`, `prisma.organizationMember`

### 1.2 `internal-authorization.service.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/internal-authorization.service.test.ts`
- **対象**: 6メソッド（`canAccessProject`, `canAccessTestSuite`, `getAccessibleProjectIds`, `canWriteToProject`, `canWriteToTestSuite`, `canWriteToExecution`）
- **テスト数**: ~31
- **テスト内容**:
  - 直接メンバーシップ / 組織経由アクセス
  - 削除済みエンティティのフィルタリング
  - WRITE権限チェック（OWNER/ADMIN/WRITEロール）
  - execution → testSuite → project のチェーン検証
  - ID重複排除
- **モック**: `prisma.project`, `prisma.projectMember`, `prisma.organizationMember`, `prisma.testSuite`, `prisma.execution`

### 1.3 `require-ownership.ts` ミドルウェアテスト

- **作成ファイル**: `src/__tests__/unit/require-ownership.middleware.test.ts`
- **対象**: `requireOwnership(paramName?)` 1ファクトリ関数
- **テスト数**: ~6
- **テスト内容**: パラメータ一致/不一致、未認証、カスタムparamName
- **参考パターン**: `require-test-case-role.middleware.test.ts`

---

## フェーズ2: レビュー機能（優先度: CRITICAL）

最大のテストギャップ。レビューコメントは完全にテスト済みだが、レビュー本体が未テスト。

### 2.1 `review.repository.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/review.repository.test.ts`
- **対象**: 19メソッド（CRUD、コメント、リプライ、検索）
- **テスト数**: ~33
- **テスト内容**:
  - `searchByTestSuite` はSUBMITTED状態のみフィルタ + verdict条件
  - `submit` は `submittedAt` + status変更
  - `create` はDRAFT状態で作成
  - include関係（author, comments, replies）の検証
- **参考パターン**: `review-comment.repository.test.ts`

### 2.2 `review.service.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/review.service.test.ts`
- **対象**: 16メソッド（ライフサイクル管理、コメント、リプライ、アクセス制御）
- **テスト数**: ~59
- **テスト内容**:
  - `startReview`: 認可チェック、重複DRAFT防止、ターゲット検証
  - `update`/`submit`/`delete`: 作成者限定 + DRAFT限定
  - `addComment`: DRAFT=作成者のみ、SUBMITTED=WRITE以上
  - `getAccessibleReview`: SUBMITTED=全員、DRAFT=作成者のみ
  - 通知送信（コメント追加時）
- **モック**: ReviewRepository, AuthorizationService, NotificationService, prisma

### 2.3 `review.controller.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/review.controller.test.ts`
- **対象**: 13メソッド
- **テスト数**: ~44
- **テスト内容**: Zodバリデーション、ステータスコード（201/204/200）、エラーハンドリング
- **参考パターン**: `review-comment.controller.test.ts`

### 2.4 レビュー統合テスト

- **作成ファイル**: `src/__tests__/integration/reviews.integration.test.ts`
- **テスト数**: ~30
- **テスト内容**:
  - レビューライフサイクル（作成→更新→提出→判定変更→削除）
  - 認可（401、他ユーザーDRAFT拒否、SUBMITTED削除不可）
  - コメント・リプライ操作
- **参考パターン**: `review-comments.integration.test.ts`

---

## フェーズ3: テスト管理コアCRUD（優先度: HIGH）

既存テストはcopy/events/history/precondition/reorderをカバー。基本CRUDが未テスト。

### 3.1 `test-case.service.ts` コアCRUDテスト

- **作成ファイル**: `src/__tests__/unit/test-case.service.crud.test.ts`
- **対象**: `create`, `findById`, `update`, `softDelete`
- **テスト数**: ~22
- **テスト内容**:
  - create: トランザクション内子エンティティ作成、orderKey計算、認可チェック
  - update: 差分履歴レコード作成、イベント発行
  - softDelete: deletedAt設定、DELETE履歴作成

### 3.2 `test-case.service.ts` 子エンティティCRUDテスト

- **作成ファイル**: `src/__tests__/unit/test-case.service.children.test.ts`
- **対象**: preconditions/steps/expectedResults の各CRUD + reorder（15メソッド）
- **テスト数**: ~45
- **テスト内容**: orderKey計算、履歴レコード、テストケース存在確認、並び替えID検証

### 3.3 `test-suite.service.ts` コアCRUDテスト

- **作成ファイル**: `src/__tests__/unit/test-suite.service.crud.test.ts`
- **対象**: `create`, `findById`, `update`, `softDelete`, `getTestCases`, `searchTestCases`, `suggestTestCases`
- **テスト数**: ~22
- **テスト内容**: プロジェクト存在確認、ステータスデフォルト、変更差分の構築

### 3.4 `test-case.repository.ts` コアCRUDテスト

- **作成ファイル**: `src/__tests__/unit/test-case.repository.crud.test.ts`
- **対象**: `findById`, `update`, `softDelete`, `suggest`, `findDeletedById`, `restore`, `getHistories`, `countHistories`
- **テスト数**: ~15

### 3.5 `test-suite.repository.ts` コアCRUDテスト

- **作成ファイル**: `src/__tests__/unit/test-suite.repository.crud.test.ts`
- **対象**: 同上パターン（8メソッド）
- **テスト数**: ~15

---

## フェーズ4: インフラ・ユーティリティ（優先度: HIGH〜MEDIUM）

### 4.1 `redis-store.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/redis-store.test.ts`
- **対象**: 40+関数（TOTP、ダッシュボードキャッシュ、ユーザー/組織/監査ログ/メトリクスキャッシュ）
- **テスト数**: ~65
- **テスト内容**:
  - キープレフィックス構築の検証
  - パラメトリックキー生成（ソート・フィルタ）
  - 本番環境Redis必須チェック（TOTP系）
  - エラーハンドリング（Redis障害時のフォールバック）
  - JSON parse/stringifyの検証
- **モック**: `ioredis`のRedisクラス、`env`設定

### 4.2 `redis-publisher.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/redis-publisher.test.ts`
- **対象**: 4関数（`publishEvent`, `publishDashboardUpdated`, `closeRedisPublisher`, `getPublisher`）
- **テスト数**: ~11
- **テスト内容**: REDIS_URL未設定時のスキップ、エラーログ、イベント構造

### 4.3 `lock-cleanup.job.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/lock-cleanup.job.test.ts`
- **対象**: 2関数
- **テスト数**: ~8
- **テスト内容**: `vi.useFakeTimers()`で定期実行テスト、コールバック呼び出し、エラーハンドリング

### 4.4 `email.service.ts` ユニットテスト

- **作成ファイル**: `src/__tests__/unit/email.service.test.ts`
- **対象**: 3メソッド（`send`, `verify`, `generateAdminInvitationEmail`）
- **テスト数**: ~11
- **テスト内容**: SMTP送信、管理者招待メール生成（HTML/テキスト）、ロール翻訳

### 4.5 `config/upload.ts` テスト

- **作成ファイル**: `src/__tests__/unit/upload.config.test.ts`
- **対象**: `isAllowedMimeType`関数 + 定数
- **テスト数**: ~6

### 4.6 `utils/logger.ts` テスト

- **作成ファイル**: `src/__tests__/unit/logger.test.ts`
- **テスト数**: ~9
- **優先度**: LOW

### 4.7 Payment Gateway Factory テスト

- **作成ファイル**: `src/__tests__/unit/payment-gateway.test.ts`
- **対象**: シングルトンファクトリ（`getPaymentGateway`, `resetPaymentGateway`, `setPaymentGateway`）
- **テスト数**: ~6

---

## フェーズ5: 課金・決済（優先度: MEDIUM-HIGH）

### 5.1 `subscription.repository.ts` — ~23テスト
### 5.2 `payment-method.repository.ts` — ~23テスト
### 5.3 `payment-event.repository.ts` — ~21テスト
### 5.4 `invoice.repository.ts` — ~7テスト
### 5.5 `payment-method.controller.ts` — ~11テスト
### 5.6 `organization-invoice.service.ts` — ~5テスト
### 5.7 `api-token.repository.ts` — ~12テスト

各ファイル `src/__tests__/unit/<名前>.test.ts` として作成。Prismaモックパターンを使用。

---

## フェーズ6: コントローラー補完（優先度: MEDIUM）

### 6.1 `notification.controller.ts` — ~18テスト
### 6.2 `oauth.controller.ts` — ~16テスト
### 6.3 `organization.controller.ts` CRUD — ~35テスト（audit-logsは既存テスト済み）
### 6.4 Admin Controllers（dashboard/metrics/audit-logs） — ~11テスト（3ファイル）

---

## 全体サマリー

| フェーズ | タスク数 | 新規テスト数 | 新規ファイル数 | 優先度 |
|---------|---------|------------|-------------|--------|
| 1. セキュリティ・認可 | 3 | ~49 | 3 | CRITICAL |
| 2. レビュー機能 | 4 | ~166 | 4 | CRITICAL |
| 3. テスト管理コアCRUD | 5 | ~119 | 5 | HIGH |
| 4. インフラ・ユーティリティ | 7 | ~116 | 7 | HIGH〜MEDIUM |
| 5. 課金・決済 | 7 | ~102 | 7 | MEDIUM-HIGH |
| 6. コントローラー補完 | 4 | ~80 | 6 | MEDIUM |
| **合計** | **30** | **~632** | **32** | |

---

## 依存関係

```
フェーズ1（依存なし・並列可能）
  1.1, 1.2, 1.3 すべて並列実行可能

フェーズ2（1.1の認可パターンを参考）
  2.1 (repository) → 2.2 (service) → 2.3 (controller)
  2.4 (integration) は2.1完了後に開始可能

フェーズ3（フェーズ2と独立・並列可能）
  3.4 (repo) → 3.1 (service CRUD)
  3.5 (repo) → 3.3 (service CRUD)
  3.2 (children) はフェーズ内独立

フェーズ4〜6（すべて独立・並列可能）
```

---

## テスト規約（既存パターン準拠）

- **ファイル配置**: `apps/api/src/__tests__/unit/` / `apps/api/src/__tests__/integration/`
- **命名**: `<feature>.<layer>.test.ts`、分割時は `<feature>.<layer>.<aspect>.test.ts`
- **モックパターン**: `vi.hoisted()` + `vi.mock('@agentest/db')` で Prismaモック
- **テストID**: 固定UUID使用（`'11111111-1111-1111-1111-111111111111'`）
- **コメント**: describe/it文字列は日本語
- **ライフサイクル**: `beforeEach(() => { vi.clearAllMocks(); })`
- **統合テスト**: `createApp()` + `supertest` + `@agentest/auth`モック + test-helpers.tsファクトリ

## 参考ファイル

- `src/__tests__/unit/review-comment.service.test.ts` — サービスユニットテストの模範
- `src/__tests__/unit/review-comment.controller.test.ts` — コントローラーテストの模範
- `src/__tests__/integration/review-comments.integration.test.ts` — 統合テストの模範
- `src/__tests__/unit/test-case.service.copy.test.ts` — 大規模サービス・トランザクションテストの模範
- `src/__tests__/integration/test-helpers.ts` — ファクトリ関数（createTestReview等が既存）

## 検証方法

各フェーズ完了時に以下を実行:
```bash
docker compose exec dev pnpm --filter api test
docker compose exec dev pnpm --filter api test:coverage
```
