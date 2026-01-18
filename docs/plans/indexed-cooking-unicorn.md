# テストスイート ラベル機能 実装計画

## 概要
GitHubのissueラベルのようなラベル機能をテストスイートに追加する。

**要件:**
- ラベルは複数つけられる
- ラベルはプロジェクトごとに自由に設定可能
- ラベル名、説明、色を設定可能

---

## 1. データベーススキーマ

### Label テーブル（ラベルマスタ）
```prisma
model Label {
  id          String    @id @default(uuid())
  projectId   String    @map("project_id")
  name        String    @db.VarChar(50)
  description String?   @db.VarChar(200)
  color       String    @db.VarChar(7)  // HEX形式 (#FFFFFF)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  testSuiteLabels TestSuiteLabel[]

  @@unique([projectId, name])
  @@index([projectId])
  @@map("labels")
}
```

### TestSuiteLabel テーブル（中間テーブル）
```prisma
model TestSuiteLabel {
  id          String   @id @default(uuid())
  testSuiteId String   @map("test_suite_id")
  labelId     String   @map("label_id")
  createdAt   DateTime @default(now()) @map("created_at")

  testSuite TestSuite @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  label     Label     @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@unique([testSuiteId, labelId])
  @@index([testSuiteId])
  @@index([labelId])
  @@map("test_suite_labels")
}
```

### 既存モデルへのリレーション追加
- `Project` に `labels Label[]` を追加
- `TestSuite` に `labels TestSuiteLabel[]` を追加

---

## 2. APIエンドポイント

### ラベル管理API（プロジェクトのサブリソース）
| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| GET | `/api/projects/:projectId/labels` | ラベル一覧取得 | READ以上 |
| POST | `/api/projects/:projectId/labels` | ラベル作成 | WRITE以上 |
| PATCH | `/api/projects/:projectId/labels/:labelId` | ラベル更新 | WRITE以上 |
| DELETE | `/api/projects/:projectId/labels/:labelId` | ラベル削除 | ADMIN |

### テストスイートラベルAPI
| メソッド | エンドポイント | 説明 | 権限 |
|---------|---------------|------|------|
| GET | `/api/test-suites/:testSuiteId/labels` | 付与済みラベル一覧 | READ以上 |
| PUT | `/api/test-suites/:testSuiteId/labels` | ラベル一括更新 | WRITE以上 |

---

## 3. 実装対象ファイル

### バックエンド
| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | Label, TestSuiteLabel モデル追加 |
| `packages/shared/src/types/label.ts` | 型定義（新規） |
| `packages/shared/src/types/index.ts` | エクスポート追加 |
| `packages/shared/src/validators/schemas.ts` | バリデーションスキーマ追加 |
| `apps/api/src/repositories/label.repository.ts` | リポジトリ（新規） |
| `apps/api/src/services/label.service.ts` | サービス（新規） |
| `apps/api/src/controllers/label.controller.ts` | コントローラー（新規） |
| `apps/api/src/routes/projects.ts` | ラベル管理ルート追加 |
| `apps/api/src/routes/test-suites.ts` | テストスイートラベルルート追加 |

### フロントエンド
| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/lib/api.ts` | APIクライアント関数追加 |
| `apps/web/src/components/ui/LabelBadge.tsx` | ラベルバッジ（新規） |
| `apps/web/src/components/label/LabelSelector.tsx` | ラベル選択UI（新規） |
| `apps/web/src/components/label/LabelFormModal.tsx` | ラベル作成/編集モーダル（新規） |
| `apps/web/src/components/label/LabelList.tsx` | プロジェクト設定用一覧（新規） |
| プロジェクト設定ページ | ラベル管理タブ追加 |
| テストスイート詳細ページ | ラベル表示/編集UI追加 |

---

## 4. 実装順序

### Phase 1: データベース
1. schema.prisma にモデル追加
2. `pnpm prisma migrate dev` 実行

### Phase 2: 型定義・バリデーション
1. `packages/shared/src/types/label.ts` 作成
2. `packages/shared/src/validators/schemas.ts` にスキーマ追加

### Phase 3: バックエンド - ラベル管理
1. LabelRepository 実装
2. LabelService 実装
3. LabelController 実装
4. routes/projects.ts にルート追加

### Phase 4: バックエンド - テストスイートラベル
1. TestSuiteService にラベル関連メソッド追加
2. TestSuiteController にラベル関連メソッド追加
3. routes/test-suites.ts にルート追加

### Phase 5: フロントエンド
1. APIクライアント関数追加
2. LabelBadge コンポーネント
3. LabelSelector コンポーネント
4. LabelFormModal コンポーネント
5. プロジェクト設定ページにラベル管理UI
6. テストスイート詳細ページにラベルUI

---

## 5. 検証方法

### API検証
```bash
# ラベル作成
curl -X POST http://localhost:3001/api/projects/{projectId}/labels \
  -H "Content-Type: application/json" \
  -d '{"name":"回帰テスト","color":"#FF5733","description":"回帰テスト用"}'

# ラベル一覧取得
curl http://localhost:3001/api/projects/{projectId}/labels

# テストスイートにラベル設定
curl -X PUT http://localhost:3001/api/test-suites/{testSuiteId}/labels \
  -H "Content-Type: application/json" \
  -d '{"labelIds":["label-uuid-1","label-uuid-2"]}'
```

### テスト
- ユニットテスト: LabelService のメソッド
- 結合テスト: APIエンドポイントの動作確認
- E2Eテスト: フロントエンドからのラベル操作
