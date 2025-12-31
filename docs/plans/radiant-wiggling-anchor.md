# MCPツール再設計計画

## 決定事項

- 命名規則: `search_*` / `get_*` / `create_*` / `update_*` / `delete_*`
- テスト実施: フルセット（事前条件/ステップ/期待結果/エビデンス）
- 完了判定: APIサーバー側で自動判別（全期待結果がPENDING以外で完了）
- Result行: Execution作成時に事前作成（PENDING/UNCHECKED）→ updateで更新

---

## 最終ツール一覧（19個）

### 検索系（4個）
| ツール名 | 説明 |
|----------|------|
| `search_project` | プロジェクト一覧検索 |
| `search_test_suite` | テストスイート検索 |
| `search_test_case` | テストケース検索 |
| `search_execution` | テスト実行検索 |

### 単一取得系（4個）
| ツール名 | 説明 |
|----------|------|
| `get_project` | プロジェクト詳細取得 |
| `get_test_suite` | テストスイート詳細取得（テストケース含む） |
| `get_test_case` | テストケース詳細取得（ステップ/期待結果含む） |
| `get_execution` | テスト実行詳細取得（全Result含む） |

### 作成系（3個）
| ツール名 | 説明 |
|----------|------|
| `create_test_suite` | テストスイート作成 |
| `create_test_case` | テストケース作成 |
| `create_execution` | テスト実行開始（スナップショット＋全Result行を自動作成） |

### 更新系（5個）
| ツール名 | 説明 |
|----------|------|
| `update_test_suite` | テストスイート更新 |
| `update_test_case` | テストケース更新 |
| `update_execution_precondition_result` | 事前条件確認結果更新（UNCHECKED→MET/NOT_MET） |
| `update_execution_step_result` | ステップ実行結果更新（PENDING→DONE/SKIPPED） |
| `update_execution_expected_result` | 期待結果判定更新（PENDING→PASS/FAIL/SKIPPED/NOT_EXECUTABLE） |

### 削除系（2個）
| ツール名 | 説明 |
|----------|------|
| `delete_test_suite` | テストスイート削除 |
| `delete_test_case` | テストケース削除 |

### エビデンス系（1個）
| ツール名 | 説明 |
|----------|------|
| `upload_execution_evidence` | エビデンスアップロード（スクリーンショット等） |

---

## テスト実施ワークフロー

```
1. create_execution                       → 実行開始（IN_PROGRESS）
                                           └ スナップショット作成
                                           └ 全PreconditionResult作成（UNCHECKED）
                                           └ 全StepResult作成（PENDING）
                                           └ 全ExpectedResult作成（PENDING）

2. update_execution_precondition_result   → 事前条件確認（MET/NOT_MET）
3. update_execution_step_result           → ステップ実行記録（DONE/SKIPPED）
4. update_execution_expected_result       → 期待結果判定（PASS/FAIL/SKIPPED/NOT_EXECUTABLE）
5. upload_execution_evidence              → エビデンス添付

6. (APIサーバー自動判定)                   → 全期待結果がPENDING以外で COMPLETED
```

---

## 実装ファイル

### 新規作成
- `apps/mcp-server/src/tools/project/` - Project関連ツール
- `apps/mcp-server/src/tools/test-suite/` - TestSuite関連ツール
- `apps/mcp-server/src/tools/test-case/` - TestCase関連ツール
- `apps/mcp-server/src/tools/execution/` - Execution関連ツール

### 修正
- `apps/mcp-server/src/tools/index.ts` - ツール登録

---

## 実装順序

### Phase 1: 基本CRUD（検索/取得/作成/更新/削除）
1. Project: search, get
2. TestSuite: search, get, create, update, delete
3. TestCase: search, get, create, update, delete

### Phase 2: テスト実施
4. Execution: search, get, create（スナップショット＋全Result行の事前作成含む）
5. ExecutionPreconditionResult: update
6. ExecutionStepResult: update
7. ExecutionExpectedResult: update
8. ExecutionEvidence: upload

### Phase 3: 自動完了判定
9. ExecutionExpectedResult更新時にExecution完了状態を自動判定するロジック追加

