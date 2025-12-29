# テストケースAPI認証問題の修正計画

## 問題の概要

`test-cases.ts`のルート定義で`requireAuth`ミドルウェアが欠けているため、テストケースをクリックすると401エラーが発生しログインにリダイレクトされる。

### 根本原因

| ファイル | 現状 | 正しい実装 |
|----------|------|-----------|
| `test-cases.ts` | `requireTestCaseRole([...])` のみ | `requireAuth(authConfig), requireTestCaseRole([...])` |
| `test-suites.ts` | `requireAuth(authConfig), requireTestSuiteRole([...])` | （参考：正しい実装） |

`requireTestCaseRole`は`req.user`の存在をチェックするが（28行目）、`requireAuth`が先に実行されないと`req.user`がセットされない。

## 修正箇所

### `apps/api/src/routes/test-cases.ts`

以下のルートに`requireAuth(authConfig)`を追加：

```typescript
// 修正前
router.get('/:testCaseId', requireTestCaseRole([...readRoles]), testCaseController.getById);

// 修正後
router.get('/:testCaseId', requireAuth(authConfig), requireTestCaseRole([...readRoles]), testCaseController.getById);
```

**対象ルート（全18箇所）:**

| 行 | メソッド | パス | 現在のミドルウェア |
|----|----------|------|-------------------|
| 26 | GET | `/:testCaseId` | `requireTestCaseRole` のみ |
| 32 | PATCH | `/:testCaseId` | `requireTestCaseRole` のみ |
| 38 | DELETE | `/:testCaseId` | `requireTestCaseRole` のみ |
| 44 | GET | `/:testCaseId/preconditions` | `requireTestCaseRole` のみ |
| 50 | POST | `/:testCaseId/preconditions` | `requireTestCaseRole` のみ |
| 56 | POST | `/:testCaseId/preconditions/reorder` | `requireTestCaseRole` のみ |
| 62 | PATCH | `/:testCaseId/preconditions/:preconditionId` | `requireTestCaseRole` のみ |
| 68 | DELETE | `/:testCaseId/preconditions/:preconditionId` | `requireTestCaseRole` のみ |
| 74 | GET | `/:testCaseId/steps` | `requireTestCaseRole` のみ |
| 80 | POST | `/:testCaseId/steps` | `requireTestCaseRole` のみ |
| 86 | POST | `/:testCaseId/steps/reorder` | `requireTestCaseRole` のみ |
| 92 | PATCH | `/:testCaseId/steps/:stepId` | `requireTestCaseRole` のみ |
| 98 | DELETE | `/:testCaseId/steps/:stepId` | `requireTestCaseRole` のみ |
| 104 | GET | `/:testCaseId/expected-results` | `requireTestCaseRole` のみ |
| 110 | POST | `/:testCaseId/expected-results` | `requireTestCaseRole` のみ |
| 116 | POST | `/:testCaseId/expected-results/reorder` | `requireTestCaseRole` のみ |
| 122 | PATCH | `/:testCaseId/expected-results/:expectedResultId` | `requireTestCaseRole` のみ |
| 128 | DELETE | `/:testCaseId/expected-results/:expectedResultId` | `requireTestCaseRole` のみ |
| 134 | POST | `/:testCaseId/copy` | `requireTestCaseRole` のみ |
| 140 | GET | `/:testCaseId/histories` | `requireTestCaseRole` のみ |
| 147 | POST | `/:testCaseId/restore` | `requireTestCaseRole` のみ |

## 修正手順

1. `apps/api/src/routes/test-cases.ts`で`requireTestCaseRole`の前に`requireAuth(authConfig)`を追加
2. TypeScript型チェックで問題がないことを確認
3. 動作確認

## 備考

- `POST /`（create）は既に`requireAuth(authConfig)`が適用されている（20行目）
- `authConfig`は既にインポート済み（5行目）
- `requireAuth`も既にインポート済み（2行目）
