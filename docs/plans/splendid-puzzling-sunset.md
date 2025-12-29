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

## UI設計方針（変更）

### 2カラムレイアウト（サイドバー + メインコンテンツ）

テストスイート詳細ページ（`TestSuiteDetail.tsx`）を以下の構成に変更:

```
┌─────────────────────────────────────────────────────────────────┐
│ ヘッダー: テストスイート名、アクションボタン                      │
├──────────────────┬──────────────────────────────────────────────┤
│ サイドバー        │ メインコンテンツ                              │
│ (w-64)           │                                              │
│                  │                                              │
│ [+ 新規作成]      │ ┌──────────────────────────────────────────┐ │
│                  │ │ テストケース詳細                          │ │
│ ┌──────────────┐ │ │                                          │ │
│ │ ≡ ケース1    │ │ │ タイトル: ログイン正常系                  │ │
│ ├──────────────┤ │ │ 優先度: HIGH  ステータス: ACTIVE          │ │
│ │ ≡ ケース2 ◀─┼─┼─│                                          │ │
│ ├──────────────┤ │ │ [前提条件]                               │ │
│ │ ≡ ケース3    │ │ │  1. ユーザーが登録済み                    │ │
│ └──────────────┘ │ │                                          │ │
│                  │ │ [ステップ]                                │ │
│ D&Dで並替可能    │ │  1. ログインページを開く                   │ │
│                  │ │  2. 認証情報を入力                        │ │
│                  │ │                                          │ │
│                  │ │ [期待結果]                                │ │
│                  │ │  1. ダッシュボードが表示される             │ │
│                  │ └──────────────────────────────────────────┘ │
└──────────────────┴──────────────────────────────────────────────┘
```

### 特徴

1. **サイドバー（左）**: テストケース一覧
   - D&D対応で順番入れ替え可能
   - クリックで右側のメインコンテンツを切り替え
   - 新規作成ボタン
   - 既存の`PageSidebarContext`を活用

2. **メインコンテンツ（右）**: 選択されたテストケースの詳細
   - ページ遷移なし（同一ページ内で切り替え）
   - 前提条件/ステップ/期待結果の管理UI
   - 履歴タブ、設定タブ

3. **テストケース未選択時**: テストスイートの概要を表示
   - 前提条件リスト（既存）
   - 実行履歴（既存）

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

### Step 2: テストケース並替API

**対象ファイル:**
- `apps/api/src/routes/test-suites.ts`
- `apps/api/src/controllers/test-suite.controller.ts`
- `apps/api/src/services/test-suite.service.ts`

**エンドポイント:**
```
POST /api/test-suites/:testSuiteId/test-cases/reorder
Request: { testCaseIds: string[] }
Response: { testCases: TestCase[] }
```

---

### Step 3: テストケース検索・フィルタ・ソートAPI

**対象ファイル:**
- `apps/api/src/routes/test-suites.ts`
- `apps/api/src/services/test-suite.service.ts`

**エンドポイント:**
```
GET /api/test-suites/:testSuiteId/test-cases
  ?q=          # タイトル・手順・期待値でLIKE検索
  &status=     # DRAFT | ACTIVE | ARCHIVED
  &priority=   # CRITICAL | HIGH | MEDIUM | LOW
  &sortBy=     # title | createdAt | updatedAt | priority | orderKey
  &sortOrder=  # asc | desc
```

---

### Step 4: テストケースコピーAPI（TC-003）

**対象ファイル:**
- `apps/api/src/routes/test-cases.ts`
- `apps/api/src/services/test-case.service.ts`

**エンドポイント:**
```
POST /api/test-cases/:testCaseId/copy
Request: { testSuiteId?: string, title?: string }
Response: { testCase: TestCaseWithDetails }
```

---

### Step 5: @参照入力用検索API（TC-004）

**対象ファイル:**
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/test-suites.ts`

**エンドポイント:**
```
GET /api/projects/:projectId/suggestions/test-suites?q=&limit=10
GET /api/test-suites/:testSuiteId/suggestions/test-cases?q=&limit=10
```

---

### Step 6: 履歴取得・復元API（TC-005）

**対象ファイル:**
- `apps/api/src/routes/test-cases.ts`
- `apps/api/src/services/test-case.service.ts`

**エンドポイント:**
```
GET  /api/test-cases/:testCaseId/histories?limit=20&offset=0
POST /api/test-cases/:testCaseId/restore
```

---

### Step 7: フロントエンド - サイドバーコンポーネント

**新規作成ファイル:**
- `apps/web/src/components/test-suite/TestCaseSidebar.tsx`

**機能:**
- テストケース一覧表示
- D&D対応（`dnd-kit`使用、`PreconditionList.tsx`を参考）
- 選択状態のハイライト
- 新規作成ボタン
- 検索ボックス（オプション）

**参照実装:** `apps/web/src/components/test-suite/PreconditionList.tsx`

---

### Step 8: フロントエンド - テストケース詳細パネル

**新規作成ファイル:**
- `apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

**コンポーネント構成:**
```
TestCaseDetailPanel
├── ヘッダー（タイトル編集、アクションメニュー）
├── タブナビゲーション（概要 / 履歴 / 設定）
├── 概要タブ
│   ├── 基本情報（優先度、ステータス、説明）
│   ├── 前提条件リスト（D&D対応）
│   ├── ステップリスト（D&D対応）
│   └── 期待結果リスト（D&D対応）
├── 履歴タブ
└── 設定タブ（削除セクション）
```

---

### Step 9: フロントエンド - テストケース用サブコンポーネント群

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

### Step 10: フロントエンド - TestSuiteDetail.tsx 改修

**修正ファイル:**
- `apps/web/src/pages/TestSuiteDetail.tsx`
- `apps/web/src/lib/api.ts`

**変更内容:**
1. `usePageSidebar()` で `TestCaseSidebar` をセット
2. 選択されたテストケースIDの状態管理（URLクエリパラメータ `?testCase=xxx`）
3. テストケース選択時: `TestCaseDetailPanel` を表示
4. テストケース未選択時: 既存の概要コンテンツを表示
5. タブシステムはテストスイートレベルで維持（概要/履歴/設定）

**状態管理:**
```typescript
// URLクエリパラメータで選択状態を管理
const [searchParams, setSearchParams] = useSearchParams();
const selectedTestCaseId = searchParams.get('testCase');

const handleSelectTestCase = (testCaseId: string | null) => {
  if (testCaseId) {
    setSearchParams({ testCase: testCaseId });
  } else {
    setSearchParams({});
  }
};
```

---

### Step 11: フロントエンド - @参照入力UI（TC-004）

**新規作成ファイル:**
- `apps/web/src/components/common/MentionInput.tsx`

**修正ファイル:**
- `apps/web/src/components/test-suite/TestCaseSidebar.tsx`（作成モーダルに統合）

---

## 変更ファイル一覧

### バックエンド
| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/routes/test-cases.ts` | 更新/削除/並替/コピー/履歴/復元API追加 |
| `apps/api/src/controllers/test-case.controller.ts` | 新規メソッド追加 |
| `apps/api/src/services/test-case.service.ts` | ビジネスロジック追加 |
| `apps/api/src/routes/test-suites.ts` | 並替API、検索パラメータ対応、suggestions API追加 |
| `apps/api/src/controllers/test-suite.controller.ts` | 並替・検索・suggestions メソッド追加 |
| `apps/api/src/services/test-suite.service.ts` | 並替・検索・suggestions ロジック追加 |
| `apps/api/src/routes/projects.ts` | suggestions/test-suites API追加 |
| `apps/api/src/controllers/project.controller.ts` | suggestions メソッド追加 |

### フロントエンド
| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/pages/TestSuiteDetail.tsx` | 2カラムレイアウト化、サイドバー統合 |
| `apps/web/src/lib/api.ts` | testCasesApi拡張、suggestionsApi追加 |
| `apps/web/src/components/test-suite/TestCaseSidebar.tsx` | 新規作成 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | 新規作成 |
| `apps/web/src/components/test-case/*` | 新規コンポーネント群（9ファイル） |
| `apps/web/src/components/common/MentionInput.tsx` | 新規作成 |

### 共通パッケージ
| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/validators/schemas.ts` | 検索・フィルタ・コピー・並替のZodスキーマ追加 |

---

## 技術的考慮事項

### サイドバー実装
- 既存の`PageSidebarContext`を使用（`Layout.tsx`で提供）
- `usePageSidebar()`フックでコンテンツを注入

### D&D実装
- `dnd-kit`使用（セットアップ済み）
- `PreconditionList.tsx`のパターンを踏襲
- オプティミスティック更新 + エラー時ロールバック

### 検索方式
- LIKE検索（`%keyword%`）を使用
- タイトル、ステップ内容、期待結果内容を対象

### 権限チェック
- OWNER, ADMIN: 全操作可能
- WRITE: 作成・更新・削除可能
- READ: 閲覧のみ

### 履歴管理
- 更新/削除時にスナップショット保存（既存実装）
- 復元は30日以内の削除のみ対象
