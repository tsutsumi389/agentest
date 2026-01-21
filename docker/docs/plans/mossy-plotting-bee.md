# 監査ログエクスポート機能 API テスト実装計画

## 概要
監査ログエクスポート機能（CSV/JSON）のAPI側ユニットテストと結合テストを作成する。

## 対象ファイル

### テスト対象
- `apps/api/src/repositories/audit-log.repository.ts` - `findForExport`メソッド
- `apps/api/src/services/audit-log.service.ts` - `getForExport`, `formatAsCSV`, `formatAsJSON`メソッド
- `apps/api/src/controllers/organization.controller.ts` - `exportAuditLogs`メソッド

### 作成するテストファイル
1. `apps/api/src/repositories/__tests__/audit-log.repository.test.ts` （既存ファイルに追加）
2. `apps/api/src/services/__tests__/audit-log.service.test.ts` （既存ファイルに追加）
3. `apps/api/src/controllers/__tests__/organization.controller.test.ts` （既存ファイルに追加）
4. `apps/api/src/__tests__/organization-audit-logs-export.integration.test.ts` （新規作成）

---

## 1. Repository ユニットテスト

### ファイル: `audit-log.repository.test.ts`

#### `findForExport` テストケース
```typescript
describe('findForExport', () => {
  // 1. 組織IDでフィルタリング
  it('指定された組織の監査ログを取得する', async () => {})

  // 2. カテゴリフィルタ
  it('カテゴリでフィルタリングできる', async () => {})

  // 3. 日付範囲フィルタ
  it('startDateでフィルタリングできる', async () => {})
  it('endDateでフィルタリングできる', async () => {})
  it('startDateとendDateの両方でフィルタリングできる', async () => {})

  // 4. ユーザー情報のinclude
  it('ユーザー情報（id, name, email）を含める', async () => {})

  // 5. 上限チェック
  it('AUDIT_LOG_EXPORT_MAX_LIMIT（10000件）まで取得する', async () => {})

  // 6. ソート順
  it('createdAtの降順でソートされる', async () => {})
})
```

---

## 2. Service ユニットテスト

### ファイル: `audit-log.service.test.ts`

#### `getForExport` テストケース
```typescript
describe('getForExport', () => {
  it('リポジトリのfindForExportを呼び出す', async () => {})
  it('オプションを正しく渡す', async () => {})
})
```

#### `formatAsCSV` テストケース
```typescript
describe('formatAsCSV', () => {
  // 1. BOMとヘッダー
  it('UTF-8 BOM付きで出力する', () => {})
  it('正しいCSVヘッダーを出力する', () => {})

  // 2. データフォーマット
  it('日時をISO形式で出力する', () => {})
  it('detailsをJSON文字列で出力する', () => {})
  it('ユーザー名とメールを出力する', () => {})

  // 3. エスケープ処理
  it('カンマを含む値をダブルクォートで囲む', () => {})
  it('ダブルクォートを含む値をエスケープする', () => {})
  it('改行を含む値を正しく処理する', () => {})

  // 4. 空データ
  it('空配列の場合はヘッダーのみ出力する', () => {})

  // 5. nullハンドリング
  it('userがnullの場合は空文字を出力する', () => {})
})
```

#### `formatAsJSON` テストケース
```typescript
describe('formatAsJSON', () => {
  it('整形されたJSONを出力する', () => {})
  it('空配列を正しく処理する', () => {})
})
```

---

## 3. Controller ユニットテスト

### ファイル: `organization.controller.test.ts`

#### `exportAuditLogs` テストケース
```typescript
describe('exportAuditLogs', () => {
  // 1. バリデーション
  it('format=csvでCSVをエクスポートする', async () => {})
  it('format=jsonでJSONをエクスポートする', async () => {})
  it('formatが未指定の場合はエラーを返す', async () => {})

  // 2. フィルタオプション
  it('categoryフィルタを渡す', async () => {})
  it('startDateとendDateフィルタを渡す', async () => {})

  // 3. レスポンスヘッダー
  it('CSVの場合Content-Typeがtext/csvになる', async () => {})
  it('JSONの場合Content-Typeがapplication/jsonになる', async () => {})
  it('Content-Dispositionにファイル名が含まれる', async () => {})

  // 4. ファイル名生成
  it('ファイル名にタイムスタンプが含まれる', async () => {})

  // 5. エラーハンドリング
  it('バリデーションエラーをnextに渡す', async () => {})
})
```

---

## 4. 結合テスト

### ファイル: `organization-audit-logs-export.integration.test.ts` （新規作成）

```typescript
describe('GET /organizations/:organizationId/audit-logs/export', () => {
  // セットアップ
  // - テスト用組織とユーザーを作成
  // - 複数の監査ログレコードを作成

  describe('認証・認可', () => {
    it('未認証の場合401を返す', async () => {})
    it('メンバー以外の場合403を返す', async () => {})
    it('ADMINユーザーはアクセスできる', async () => {})
    it('OWNERユーザーはアクセスできる', async () => {})
  })

  describe('CSVエクスポート', () => {
    it('format=csvでCSVファイルをダウンロードできる', async () => {})
    it('Content-Typeがtext/csv; charset=utf-8になる', async () => {})
    it('Content-Dispositionにファイル名が含まれる', async () => {})
    it('BOMが含まれる', async () => {})
    it('データが正しくフォーマットされている', async () => {})
  })

  describe('JSONエクスポート', () => {
    it('format=jsonでJSONファイルをダウンロードできる', async () => {})
    it('Content-Typeがapplication/jsonになる', async () => {})
    it('有効なJSON形式で出力される', async () => {})
  })

  describe('フィルタリング', () => {
    it('categoryでフィルタリングできる', async () => {})
    it('startDateでフィルタリングできる', async () => {})
    it('endDateでフィルタリングできる', async () => {})
    it('複数フィルタを組み合わせできる', async () => {})
  })

  describe('バリデーション', () => {
    it('formatが未指定の場合400を返す', async () => {})
    it('無効なformatの場合400を返す', async () => {})
    it('無効なcategoryの場合400を返す', async () => {})
    it('startDate > endDateの場合400を返す', async () => {})
  })
})
```

---

## 実装手順

1. **Repository テスト追加** (`audit-log.repository.test.ts`)
   - `findForExport`のdescribeブロックを追加

2. **Service テスト追加** (`audit-log.service.test.ts`)
   - `getForExport`、`formatAsCSV`、`formatAsJSON`のdescribeブロックを追加

3. **Controller テスト追加** (`organization.controller.test.ts`)
   - `exportAuditLogs`のdescribeブロックを追加

4. **結合テスト新規作成** (`organization-audit-logs-export.integration.test.ts`)
   - 既存の`organization-audit-logs.integration.test.ts`を参考に作成

---

## 検証方法

```bash
# コンテナ内でテスト実行
docker compose exec dev pnpm --filter @agentest/api test

# 特定のテストファイルのみ実行
docker compose exec dev pnpm --filter @agentest/api test audit-log.repository
docker compose exec dev pnpm --filter @agentest/api test audit-log.service
docker compose exec dev pnpm --filter @agentest/api test organization.controller
docker compose exec dev pnpm --filter @agentest/api test organization-audit-logs-export.integration
```

---

## 参考: 既存テストパターン

### モック設定（vi.hoisted使用）
```typescript
const mockPrisma = vi.hoisted(() => ({
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
  AuditLogCategory: { AUTH: 'AUTH', USER: 'USER', ... },
}));
```

### Express Request/Responseモック
```typescript
const mockReq = {
  params: { organizationId: 'org-id' },
  query: { format: 'csv' },
  user: { id: 'user-id' },
} as unknown as Request;

const mockRes = {
  setHeader: vi.fn(),
  send: vi.fn(),
  json: vi.fn(),
} as unknown as Response;

const mockNext = vi.fn() as NextFunction;
```

### 結合テスト認証
```typescript
const authHeader = `Bearer ${await generateTestToken(user.id)}`;
const response = await request(app)
  .get(`/organizations/${org.id}/audit-logs/export?format=csv`)
  .set('Authorization', authHeader);
```
