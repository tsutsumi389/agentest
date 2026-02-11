# プロジェクトメンバー追加機能の修正

## Context

プロジェクトのメンバー追加機能が動作しない。原因はフロントエンドとバックエンドのAPI仕様の不一致。

- **フロントエンド**: `{ email: string, role: string }` を送信
- **バックエンド**: `{ userId: string (UUID), role: string }` を期待

→ Zodバリデーションエラーが毎回発生し、メンバー追加が常に失敗する。

## 修正方針

**バックエンドのコントローラーを修正**して `email` を受け付けるようにする。

- サービス層（`ProjectService.addMember`）のシグネチャは変更しない
- コントローラー層で email → userId の変換を吸収
- 既存の `UserRepository.findByEmail()` を再利用

## 変更対象ファイル

### 1. `apps/api/src/controllers/project.controller.ts`（主要修正）

**a) import 追加**
- `NotFoundError` を `@agentest/shared` からインポート
- `UserRepository` を `../repositories/user.repository.js` からインポート

**b) Zodスキーマ変更（38-41行目）**
```typescript
// Before
const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'WRITE', 'READ']).default('READ'),
});

// After
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'WRITE', 'READ']).default('READ'),
});
```

**c) クラスにプロパティ追加**
```typescript
private userRepo = new UserRepository();
```

**d) addMember メソッド修正（128-138行目）**
- `data.email` からユーザーを検索
- 見つからない場合は `NotFoundError('User')` をthrow
- 見つかったら `user.id` をサービスに渡す

### 2. `apps/api/src/__tests__/unit/project.controller.test.ts`（テスト更新）

- `UserRepository` のモック追加
- 既存テストを `userId` → `email` に変更
- 「ユーザーが見つからない」テストケース追加
- 「不正なメールアドレス」テストケース追加

### 3. `apps/api/src/__tests__/integration/project-member-owner.integration.test.ts`（テスト更新）

- リクエストボディの `userId` → `email` に変更

## 変更しないファイル

| ファイル | 理由 |
|---------|------|
| `apps/web/src/components/project/AddProjectMemberModal.tsx` | 既に正しく email を送信 |
| `apps/web/src/lib/api.ts` | 既に正しい型定義 |
| `apps/api/src/services/project.service.ts` | シグネチャ変更不要 |
| `apps/api/src/repositories/user.repository.ts` | `findByEmail` が既に存在 |
| `apps/api/src/routes/projects.ts` | ルーティング変更不要 |

## エラーレスポンスの整合性

| 条件 | HTTP Status | フロントエンドの表示 |
|------|------------|-------------------|
| 不正なメールアドレス形式 | 400 (VALIDATION_ERROR) | フィールドエラー表示 |
| 存在しないメールアドレス | 404 (NOT_FOUND) | 「ユーザーが見つかりません」 |
| 既にメンバー | 409 (CONFLICT) | 「このユーザーは既にメンバーです」 |

フロントエンドの既存エラーハンドリング（84-98行目）と完全に整合する。

## 検証方法

1. `docker compose exec dev pnpm test --filter=api` でユニット・統合テストが全パスすることを確認
2. `docker compose exec dev pnpm build` でビルドが通ることを確認
3. 画面からプロジェクト設定→メンバー追加で、メールアドレスを入力して追加できることを手動確認
