# Phase 7: レビュー機能 実装計画

## 概要

テストスイート/テストケースへのレビューコメント機能を実装する。

### 対象要件
- RC-001: コメント登録
- RC-002: 返信
- RC-005: 解決（OPEN ↔ RESOLVED）
- TS-005: テストスイートレビュー連携
- TC-006: テストケースレビュー連携
- **追加**: 編集・削除機能

### 対象外
- リアルタイム通知（Phase 12）
- Agent連携MCP実装（Phase 8）

---

## 1. APIエンドポイント

### 新規ルート: `/apps/api/src/routes/review-comments.ts`

| Method | Endpoint | 説明 | 認可 |
|--------|----------|------|------|
| POST | `/api/review-comments` | コメント作成 | 対象リソースWRITE以上 |
| GET | `/api/review-comments/:commentId` | コメント詳細 | 対象リソースREAD以上 |
| PATCH | `/api/review-comments/:commentId` | コメント編集 | 投稿者本人のみ |
| DELETE | `/api/review-comments/:commentId` | コメント削除 | 投稿者本人のみ |
| PATCH | `/api/review-comments/:commentId/status` | ステータス変更 | 対象リソースWRITE以上 |
| POST | `/api/review-comments/:commentId/replies` | 返信作成 | 対象リソースWRITE以上 |
| PATCH | `/api/review-comments/:commentId/replies/:replyId` | 返信編集 | 投稿者本人のみ |
| DELETE | `/api/review-comments/:commentId/replies/:replyId` | 返信削除 | 投稿者本人のみ |

### 既存ルートへの追加

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/test-suites/:testSuiteId/comments` | スイートのコメント一覧 |
| GET | `/api/test-cases/:testCaseId/comments` | ケースのコメント一覧 |

---

## 2. 型定義・バリデーション

### 新規ファイル: `/packages/shared/src/types/review.ts`

```typescript
export interface ReviewComment {
  id: string;
  targetType: 'SUITE' | 'CASE';
  targetId: string;
  targetField: 'TITLE' | 'DESCRIPTION' | 'PRECONDITION' | 'STEP' | 'EXPECTED_RESULT';
  targetItemId: string | null;
  authorUserId: string | null;
  authorAgentSessionId: string | null;
  content: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewCommentWithReplies extends ReviewComment {
  author: { id: string; name: string; avatarUrl: string | null } | null;
  agentSession: { id: string; clientName: string | null } | null;
  replies: ReviewReply[];
  _count: { replies: number };
}

export interface ReviewReply {
  id: string;
  commentId: string;
  authorUserId: string | null;
  authorAgentSessionId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { ... } | null;
  agentSession: { ... } | null;
}
```

### バリデーション追加: `/packages/shared/src/validators/schemas.ts`

```typescript
export const reviewCommentCreateSchema = z.object({
  targetType: z.enum(['SUITE', 'CASE']),
  targetId: z.string().uuid(),
  targetField: z.enum(['TITLE', 'DESCRIPTION', 'PRECONDITION', 'STEP', 'EXPECTED_RESULT']),
  targetItemId: z.string().uuid().optional(),
  content: z.string().min(1).max(2000),
});

export const reviewCommentUpdateSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const reviewStatusUpdateSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED']),
});

export const reviewReplyCreateSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const reviewCommentSearchSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'ALL']).default('ALL'),
  targetField: z.enum(['TITLE', 'DESCRIPTION', 'PRECONDITION', 'STEP', 'EXPECTED_RESULT']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
```

---

## 3. バックエンド実装

### 新規ファイル

| ファイル | 責務 |
|----------|------|
| `/apps/api/src/repositories/review-comment.repository.ts` | DB操作 |
| `/apps/api/src/services/review-comment.service.ts` | ビジネスロジック・認可 |
| `/apps/api/src/controllers/review-comment.controller.ts` | リクエスト処理 |
| `/apps/api/src/routes/review-comments.ts` | ルーティング |
| `/apps/api/src/middleware/require-review-comment-role.ts` | コメント権限ミドルウェア |

### 設計ポイント

**認可ロジック**:
- コメント/返信の作成: 対象リソース（スイート/ケース）のWRITE以上
- 編集/削除: `authorUserId === currentUser.id`（投稿者本人のみ）
- ステータス変更: 対象リソースのWRITE以上

**ターゲット検証**:
- `targetType = 'SUITE'`: TestSuiteの存在・アクセス権確認
- `targetType = 'CASE'`: TestCaseの存在・アクセス権確認
- `targetItemId`指定時: 該当前提条件/ステップ/期待結果の存在確認

---

## 4. フロントエンド実装

### 新規コンポーネント

| コンポーネント | パス | 責務 |
|---------------|------|------|
| `ReviewCommentList` | `components/review/ReviewCommentList.tsx` | コメント一覧・フィルタ |
| `ReviewCommentItem` | `components/review/ReviewCommentItem.tsx` | コメント表示・アコーディオン |
| `ReviewCommentForm` | `components/review/ReviewCommentForm.tsx` | コメント/返信入力 |
| `ReviewCommentEditor` | `components/review/ReviewCommentEditor.tsx` | インライン編集 |
| `ReviewStatusBadge` | `components/review/ReviewStatusBadge.tsx` | OPEN/RESOLVEDバッジ |

### 既存ページ統合

**TestSuiteDetail.tsx**:
- タブに「レビュー」追加
- `ReviewCommentList` を表示

**TestCaseDetailPanel.tsx**:
- タブに「レビュー」追加
- 各項目（説明、前提条件、ステップ、期待結果）横にコメントアイコン表示

### APIクライアント追加: `/apps/web/src/lib/api.ts`

```typescript
export const reviewCommentsApi = {
  create: (data) => api.post('/api/review-comments', data),
  getById: (commentId) => api.get(`/api/review-comments/${commentId}`),
  update: (commentId, data) => api.patch(`/api/review-comments/${commentId}`, data),
  delete: (commentId) => api.delete(`/api/review-comments/${commentId}`),
  updateStatus: (commentId, status) => api.patch(`/api/review-comments/${commentId}/status`, { status }),
  createReply: (commentId, data) => api.post(`/api/review-comments/${commentId}/replies`, data),
  updateReply: (commentId, replyId, data) => api.patch(`/api/review-comments/${commentId}/replies/${replyId}`, data),
  deleteReply: (commentId, replyId) => api.delete(`/api/review-comments/${commentId}/replies/${replyId}`),
};

// testSuitesApi, testCasesApi に getComments() 追加
```

### React Query キー

```typescript
['review-comments', { targetType, targetId }]           // 一覧
['review-comments', { targetType, targetId, status }]   // フィルタ済み
['review-comment', commentId]                           // 詳細
```

---

## 5. 実装順序

### Step 1: 型定義・バリデーション
- [x] `/packages/shared/src/types/review.ts` 新規作成
- [x] `/packages/shared/src/types/index.ts` に export 追加
- [x] `/packages/shared/src/validators/schemas.ts` にスキーマ追加

### Step 2: リポジトリ層
- [x] `/apps/api/src/repositories/review-comment.repository.ts` 新規作成

### Step 3: サービス層
- [x] `/apps/api/src/services/review-comment.service.ts` 新規作成

### Step 4: コントローラー・ルーティング
- [x] `/apps/api/src/controllers/review-comment.controller.ts` 新規作成
- [x] `/apps/api/src/routes/review-comments.ts` 新規作成
- [x] `/apps/api/src/routes/test-suites.ts` にコメント一覧追加
- [x] `/apps/api/src/routes/test-cases.ts` にコメント一覧追加
- [x] `/apps/api/src/routes/index.ts` にルート登録

### Step 5: ミドルウェア
- [x] `/apps/api/src/middleware/require-review-comment-role.ts` 新規作成

### Step 6: APIクライアント
- [x] `/apps/web/src/lib/api.ts` にAPI追加

### Step 7: UIコンポーネント
- [x] `ReviewStatusBadge.tsx`
- [x] `ReviewCommentForm.tsx`
- [x] `ReviewCommentEditor.tsx`
- [x] `ReviewCommentItem.tsx`
- [x] `ReviewCommentList.tsx`

### Step 8: 既存ページ統合
- [x] `TestSuiteDetail.tsx` にレビュータブ追加
- [x] `TestCaseDetailPanel.tsx` にレビュータブ追加

### Step 9: テスト
- [x] `/apps/api/src/__tests__/integration/review-comments.integration.test.ts` 新規作成

---

## 6. テスト計画

### API結合テスト

```typescript
describe('POST /api/review-comments', () => {
  it('スイートへのコメントを作成できる');
  it('ケースへのコメントを作成できる');
  it('削除されたターゲットにはコメントできない');
});

describe('PATCH /api/review-comments/:commentId', () => {
  it('投稿者本人は編集できる');
  it('他人のコメントは編集できない');
});

describe('DELETE /api/review-comments/:commentId', () => {
  it('投稿者本人は削除できる');
  it('削除時に返信も削除される');
});

describe('PATCH /api/review-comments/:commentId/status', () => {
  it('WRITE権限以上でステータス変更できる');
  it('OPEN → RESOLVED に変更できる');
  it('RESOLVED → OPEN に変更できる');
});

describe('返信操作', () => {
  it('返信を作成・編集・削除できる');
});
```

---

## 7. 注意事項

### DBスキーマについて
- `targetField`は必須（スキーマ変更なし）
- 「全体」へのコメントは `targetField = 'TITLE'` として扱う
- UIでは「タイトル」ではなく「全体」として表示

### 参考ファイル
- サービス層: `/apps/api/src/services/test-suite.service.ts`
- API型定義: `/apps/web/src/lib/api.ts`
- インライン編集: `/apps/web/src/components/execution/InlineNoteEditor.tsx`
- アクションメニュー: `/apps/web/src/components/common/ActionDropdown.tsx`
