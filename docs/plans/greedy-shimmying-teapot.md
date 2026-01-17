# プロジェクトダッシュボードAPI テスト実装計画

## 概要
`apps/api/src/services/project-dashboard.service.ts` のユニットテストと結合テストを作成する。

## ファイル構成

```
apps/api/src/__tests__/
├── unit/
│   └── project-dashboard.service.test.ts    # サービスユニットテスト（新規）
└── integration/
    └── project-dashboard.integration.test.ts # 結合テスト（新規）
```

---

## Phase 1: ユニットテスト

### ファイル: `apps/api/src/__tests__/unit/project-dashboard.service.test.ts`

### モック構成

```typescript
const mockPrisma = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  testCase: { count: vi.fn(), findMany: vi.fn() },
  execution: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  executionExpectedResult: { findMany: vi.fn(), groupBy: vi.fn() },
  testCaseHistory: { findMany: vi.fn() },
  review: { findMany: vi.fn() },
  testSuite: { findMany: vi.fn() },
}));

vi.mock('@agentest/db', () => ({ prisma: mockPrisma }));
```

### テストケース

#### getDashboard（メイン）
| 種別 | テスト内容 |
|------|----------|
| 正常 | プロジェクト存在時に統計を取得できる |
| 異常 | 存在しないプロジェクトはNotFoundError |
| 異常 | 削除済みプロジェクトはNotFoundError |

#### getSummary
| 種別 | テスト内容 |
|------|----------|
| 正常 | テストケース総数/実行中数/最終実行日時/成功率を取得 |
| 境界 | テストケースがない場合は0 |
| 境界 | 実行がない場合はlastExecutionAt=null, passRate=0 |

#### getResultDistribution
| 種別 | テスト内容 |
|------|----------|
| 正常 | 各ステータス(PASS/FAIL/SKIPPED/NOT_EXECUTABLE/PENDING)のカウント |
| 境界 | 結果がない場合は全て0 |

#### getFailingTests
| 種別 | テスト内容 |
|------|----------|
| 正常 | 最新がFAILのテストを連続失敗回数順で取得（最大10件） |
| 境界 | テストケースがない場合は空配列 |
| 境界 | 最新がFAIL以外はスキップ |

#### getLongNotExecutedTests
| 種別 | テスト内容 |
|------|----------|
| 正常 | 30日以上未実行/一度も未実行のテストを取得 |
| 境界 | 29日前は対象外、30日前は対象 |

#### getFlakyTests
| 種別 | テスト内容 |
|------|----------|
| 正常 | 過去10回で成功率50-90%のテストを取得 |
| 境界 | 49%/91%は対象外、50%/90%は対象 |
| 境界 | 3回未満の実行はスキップ |

#### getRecentActivities
| 種別 | テスト内容 |
|------|----------|
| 正常 | execution/testCaseUpdate/reviewを日時降順で取得（最大10件） |
| 境界 | 活動がない場合は空配列 |

#### getSuiteCoverage
| 種別 | テスト内容 |
|------|----------|
| 正常 | 各スイートのテスト数/実行済み数/成功率/最終実行日時 |
| 境界 | スイートがない場合は空配列 |

---

## Phase 2: 結合テスト

### ファイル: `apps/api/src/__tests__/integration/project-dashboard.integration.test.ts`

### 認証モック（既存パターン流用）

```typescript
vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req, _res, next) => { ... },
  requireProjectRole: (roles) => (_req, _res, next) => { ... },
  // ...
}));

function setTestAuth(user, projectRole) { ... }
```

### テストケース

#### 認証・認可
| テスト内容 |
|----------|
| 未認証の場合は401エラー |
| プロジェクトメンバーでない場合は403エラー |
| READ/WRITE/ADMIN権限でダッシュボードを取得できる |

#### 正常系
| テスト内容 |
|----------|
| 空のプロジェクトでダッシュボードを取得（全て0/空） |
| テストケースがある場合にサマリーを取得 |
| 実行中テストがある場合にinProgressExecutions取得 |
| 過去30日間の成功率を取得 |
| 実行結果分布を取得 |
| 失敗中テスト一覧を取得 |
| 長期未実行テスト一覧を取得 |
| 不安定テスト一覧を取得 |
| 最近の活動一覧を取得 |
| テストスイート別カバレッジを取得 |

#### 境界値
| テスト内容 |
|----------|
| 31日前の実行は成功率に含まれない |
| ちょうど30日前未実行は長期未実行に含まれる |

#### 異常系
| テスト内容 |
|----------|
| 存在しないプロジェクトIDは404エラー |
| 削除済みプロジェクトは404エラー |

---

## 実装順序

1. ユニットテストファイル作成（Prismaモック設定）
2. getDashboard + 各サブメソッドのテスト実装
3. 結合テストファイル作成（認証モック設定）
4. 認証・認可テスト実装
5. 正常系・境界値・異常系テスト実装
6. `docker compose exec dev pnpm test` で全テスト実行

---

## 参照ファイル

| ファイル | 用途 |
|---------|------|
| `apps/api/src/services/project-dashboard.service.ts` | テスト対象 |
| `apps/api/src/__tests__/unit/project.service.environment.test.ts` | モックパターン参照 |
| `apps/api/src/__tests__/integration/project-environments.integration.test.ts` | 結合テストパターン参照 |
| `apps/api/src/__tests__/integration/test-helpers.ts` | ファクトリー関数使用 |

---

## 検証方法

```bash
# 全テスト実行
docker compose exec dev pnpm test

# 特定テストのみ
docker compose exec dev pnpm test project-dashboard
```
