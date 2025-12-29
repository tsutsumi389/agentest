# Phase 5: テストケース管理 実装計画

## 概要

テスト管理ツールSaaS「Agentest」のPhase 5として、テストケース管理機能を実装する。

## 対象要件

| ID | 機能 | 状況 |
|----|------|------|
| TC-001 | テストケース作成 | ✅ 実装済み（API・基本UI） |
| TC-002 | テストケース構造（前提条件/手順/期待値） | ✅ 実装済み（API）、❌ UI未実装 |
| TC-003 | テストケースコピー | ❌ 未実装 |
| TC-004 | @参照入力（作成時のみ） | ❌ 未実装 |
| TC-005 | テストケース履歴・復元 | ⚠️ 履歴保存のみ、取得・復元API・UI未実装 |
| TC-007 | テストケース削除 | ✅ 実装済み |
| TC-008 | テストケース検索（LIKE検索） | ❌ 未実装 |
| TC-009 | テストケースフィルタ | ❌ 未実装 |
| TC-010 | テストケースソート | ❌ 未実装 |

---

## 実装順序

### Step 1: バックエンドAPI拡充（前提条件/ステップ/期待結果の完全CRUD）

**対象ファイル:**
- `apps/api/src/routes/test-cases.ts`
- `apps/api/src/controllers/test-case.controller.ts`
- `apps/api/src/services/test-case.service.ts`

**追加エンドポイント:**
```
PATCH  /api/test-cases/:testCaseId/preconditions/:preconditionId
DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId
POST   /api/test-cases/:testCaseId/preconditions/reorder

PATCH  /api/test-cases/:testCaseId/steps/:stepId
DELETE /api/test-cases/:testCaseId/steps/:stepId
POST   /api/test-cases/:testCaseId/steps/reorder

PATCH  /api/test-cases/:testCaseId/expected-results/:expectedResultId
DELETE /api/test-cases/:testCaseId/expected-results/:expectedResultId
POST   /api/test-cases/:testCaseId/expected-results/reorder
```

---

### Step 2: テストケース検索・フィルタ・ソートAPI

**対象ファイル:**
- `apps/api/src/routes/test-suites.ts`
- `apps/api/src/controllers/test-suite.controller.ts`
- `apps/api/src/services/test-suite.service.ts`

**エンドポイント:**
```
GET /api/test-suites/:testSuiteId/test-cases
  ?q=          # タイトル・手順・期待値でLIKE検索
  &status=     # DRAFT | ACTIVE | ARCHIVED
  &priority=   # CRITICAL | HIGH | MEDIUM | LOW
  &sortBy=     # title | createdAt | updatedAt | priority
  &sortOrder=  # asc | desc
  &limit=      # default: 50
  &offset=     # default: 0
```

---

### Step 3: テストケースコピーAPI（TC-003）

**対象ファイル:**
- `apps/api/src/routes/test-cases.ts`
- `apps/api/src/services/test-case.service.ts`

**エンドポイント:**
```
POST /api/test-cases/:testCaseId/copy

Request: { testSuiteId?: string, title?: string }
Response: { testCase: TestCaseWithDetails }
```

**動作:**
1. 元テストケース + 前提条件/ステップ/期待結果を取得
2. 新しいテストケースとして複製（orderKey新規生成）
3. タイトル省略時は「{元タイトル} (コピー)」

---

### Step 4: @参照入力用検索API（TC-004）

**対象ファイル:**
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/test-suites.ts`
- `apps/api/src/controllers/project.controller.ts`
- `apps/api/src/controllers/test-suite.controller.ts`

**エンドポイント:**
```
GET /api/projects/:projectId/suggestions/test-suites?q=&limit=10
GET /api/test-suites/:testSuiteId/suggestions/test-cases?q=&limit=10
```

---

### Step 5: 履歴取得・復元API（TC-005）

**対象ファイル:**
- `apps/api/src/routes/test-cases.ts`
- `apps/api/src/services/test-case.service.ts`

**エンドポイント:**
```
GET  /api/test-cases/:testCaseId/histories?limit=20&offset=0
POST /api/test-cases/:testCaseId/restore
```

---

### Step 6: フロントエンド - テストケース詳細ページ

**新規作成ファイル:**
- `apps/web/src/pages/TestCaseDetail.tsx`

**修正ファイル:**
- `apps/web/src/App.tsx` （ルート追加: `/test-cases/:testCaseId`）

**コンポーネント構成:**
```
TestCaseDetailPage
├── ヘッダー（パンくず、タイトル、アクションボタン）
├── タブ（概要 / 履歴 / 設定）
├── 概要タブ
│   ├── 基本情報（優先度、ステータス、説明）
│   ├── 前提条件リスト（ドラッグ&ドロップ対応）
│   ├── ステップリスト（ドラッグ&ドロップ対応）
│   └── 期待結果リスト（ドラッグ&ドロップ対応）
├── 履歴タブ
└── 設定タブ（削除セクション）
```

---

### Step 7: フロントエンド - テストケース用コンポーネント群

**新規作成ファイル:**
```
apps/web/src/components/test-case/
├── TestCasePreconditionList.tsx
├── TestCasePreconditionFormModal.tsx
├── TestCaseStepList.tsx
├── TestCaseStepFormModal.tsx
├── TestCaseExpectedResultList.tsx
├── TestCaseExpectedResultFormModal.tsx
├── TestCaseHistoryList.tsx
├── DeleteTestCaseSection.tsx
└── CopyTestCaseModal.tsx
```

**参照実装:** `apps/web/src/components/test-suite/PreconditionList.tsx`

---

### Step 8: フロントエンド - 検索・フィルタ・ソートUI

**新規作成ファイル:**
- `apps/web/src/components/test-suite/TestCaseSearchFilter.tsx`

**修正ファイル:**
- `apps/web/src/pages/TestSuiteDetail.tsx`
- `apps/web/src/lib/api.ts`

**機能:**
- 検索ボックス（debounce 300ms）
- ステータスフィルタ（ドロップダウン）
- 優先度フィルタ（ドロップダウン）
- ソートオプション

---

### Step 9: フロントエンド - @参照入力UI（TC-004）

**新規作成ファイル:**
- `apps/web/src/components/common/MentionInput.tsx`

**修正ファイル:**
- `apps/web/src/pages/TestSuiteDetail.tsx`（CreateTestCaseModalに統合）

**動作:**
1. タイトル入力で `@` を入力 → テストスイート候補表示
2. スイート選択後 `/` を入力 → テストケース候補表示
3. テストケース選択 → 内容プレビュー表示
4. 「コピーして作成」ボタン → 前提条件/ステップ/期待結果を複製

---

### Step 10: フロントエンド - テストケース行の遷移・アクション

**修正ファイル:**
- `apps/web/src/pages/TestSuiteDetail.tsx`

**変更点:**
- TestCaseRowをクリックで詳細ページ（`/test-cases/:testCaseId`）へ遷移
- アクションメニューにコピー機能を追加

---

## 変更ファイル一覧

### バックエンド
| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/routes/test-cases.ts` | 更新/削除/並替/コピー/履歴/復元API追加 |
| `apps/api/src/controllers/test-case.controller.ts` | 新規メソッド追加 |
| `apps/api/src/services/test-case.service.ts` | ビジネスロジック追加 |
| `apps/api/src/routes/test-suites.ts` | 検索パラメータ対応、suggestions API追加 |
| `apps/api/src/controllers/test-suite.controller.ts` | 検索・suggestions メソッド追加 |
| `apps/api/src/services/test-suite.service.ts` | 検索・suggestions ロジック追加 |
| `apps/api/src/routes/projects.ts` | suggestions/test-suites API追加 |
| `apps/api/src/controllers/project.controller.ts` | suggestions メソッド追加 |

### フロントエンド
| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/App.tsx` | テストケース詳細ルート追加 |
| `apps/web/src/pages/TestCaseDetail.tsx` | 新規作成 |
| `apps/web/src/pages/TestSuiteDetail.tsx` | 検索・フィルタUI追加、行クリック遷移 |
| `apps/web/src/lib/api.ts` | testCasesApi拡張、suggestionsApi追加 |
| `apps/web/src/components/test-case/*` | 新規コンポーネント群（9ファイル） |
| `apps/web/src/components/test-suite/TestCaseSearchFilter.tsx` | 新規作成 |
| `apps/web/src/components/common/MentionInput.tsx` | 新規作成 |

### 共通パッケージ
| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/validators/schemas.ts` | 検索・フィルタ・コピーのZodスキーマ追加 |

---

## 技術的考慮事項

### 検索方式
- LIKE検索（`%keyword%`）を使用
- タイトル、ステップ内容、期待結果内容を対象

### 権限チェック
- OWNER, ADMIN: 全操作可能
- WRITE: 作成・更新・削除可能
- READ: 閲覧のみ

### ドラッグ&ドロップ
- dnd-kit使用（PreconditionListの実装パターン踏襲）
- オプティミスティック更新 + エラー時ロールバック

### 履歴管理
- 更新/削除時にスナップショット保存（既存実装）
- 復元は30日以内の削除のみ対象
