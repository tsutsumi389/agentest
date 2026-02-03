# TDD移行計画 - 不足テストの作成

## 現状分析

### テスト環境の概要

| ディレクトリ | テストファイル数 | 設定 | 状態 |
|------------|---------------|------|------|
| apps/api | 140 | vitest.config.ts | ✅ 成熟 |
| apps/mcp-server | 29 | vitest.config.ts | ✅ 成熟 |
| apps/jobs | 13 | vitest.config.ts | ✅ 成熟 |
| packages/shared | 4 | vitest.config.ts (80%閾値) | ✅ 成熟 |
| apps/admin | 0 | なし | ❌ 未構築 |
| apps/web | 0 | なし | ❌ 未構築 |
| apps/ws | 5 | vitest.config.ts (80%閾値) | ✅ 完了 |
| packages/auth | 6 | vitest.config.ts (80%閾値) | ✅ 完了 |
| packages/db | 0 | なし | ❌ 未構築 |
| packages/storage | 1 | vitest.config.ts (80%閾値) | ✅ 完了 |
| packages/ui | 2 | vitest.config.ts (80%閾値) | ✅ 完了 |
| packages/ws-types | 0 | なし | ⏭️ 型定義のみ |

**総計**: 195テストファイル（7ディレクトリ）

---

## フェーズ1: 基盤パッケージのテスト環境構築（優先度: 高）

ビジネスロジックを含む基盤パッケージから着手。

### 1.1 packages/auth

**理由**: 認証は全アプリの基盤。セキュリティ上の欠陥が致命的。

**対象ファイル**:
- `src/jwt/` - JWT生成・検証
- `src/oauth/` - OAuthプロバイダー連携
- `src/session/` - セッション管理
- `src/middleware/` - 認証ミドルウェア

**タスク**:
- [x] vitest.config.ts作成
- [x] テストセットアップファイル作成 (`src/__tests__/helpers.ts`)
- [x] JWTユーティリティのユニットテスト (`jwt.test.ts`)
- [x] OAuth認証フローのテスト (`passport.test.ts`)
- [x] 設定バリデーションのテスト (`config.test.ts`)
- [x] ミドルウェアのユニットテスト (`authenticate.test.ts`, `require-org-role.test.ts`, `require-project-role.test.ts`)

### 1.2 packages/storage

**理由**: ファイルアップロード・エビデンス保存の信頼性確保。

**対象ファイル**:
- `src/client/` - S3/MinIOクライアント
- `src/upload/` - アップロード処理
- `src/presigned/` - 署名付きURL生成

**タスク**:
- [x] vitest.config.ts作成
- [x] AWS SDK（S3Client）モックの作成
- [x] アップロード・ダウンロード・削除のユニットテスト
- [x] 署名付きURL生成のテスト
- [x] ファイル存在確認・メタデータ取得のテスト
- [x] ファイル一覧・コピーのテスト

---

## フェーズ2: バックエンドサービスのテスト（優先度: 中高）

### 2.1 apps/ws

**理由**: リアルタイム通知はUXに直結。

**対象機能**:
- WebSocket接続管理
- イベントブロードキャスト
- 認証済み接続の検証
- 再接続ハンドリング

**タスク**:
- [x] vitest.config.ts作成
- [x] WebSocketモックの作成
- [x] 接続・切断のユニットテスト
- [x] イベント配信の統合テスト
- [x] 認証検証のテスト

**完了**: 2026-02-03（カバレッジ99.31%）

---

## フェーズ3: フロントエンドのテスト環境構築（優先度: 中）

### 3.1 packages/ui

**理由**: 共通コンポーネントはすべてのSPAで使用。

**対象コンポーネント**:
- Button, Input, Select等の基本コンポーネント
- Modal, Dialog等のインタラクティブコンポーネント
- Form系コンポーネント

**タスク**:
- [x] vitest.config.ts + @testing-library/react設定
- [x] コンポーネントのレンダリングテスト
- [x] ユーザーインタラクションテスト
- [x] アクセシビリティテスト

**完了**: 2026-02-04（カバレッジ100%）

### 3.2 apps/web

**理由**: メインのユーザー向けアプリケーション。

**対象**:
- ページコンポーネント
- カスタムフック
- 状態管理
- APIクライアント

**タスク**:
- [ ] vitest.config.ts + testing-library設定
- [ ] カスタムフックのテスト
- [ ] ページコンポーネントのテスト
- [ ] E2Eテスト環境（Playwright）の検討

### 3.3 apps/admin

**理由**: 管理機能の信頼性確保。

**タスク**:
- [ ] apps/webと同様のテスト環境構築
- [ ] 管理機能特有のテスト

---

## フェーズ4: 型定義パッケージ（優先度: 低）

### 4.1 packages/ws-types

**備考**: 型定義のみのため、TypeScriptの型チェックで十分。ランタイムテストは不要。

### 4.2 packages/db

**備考**: Prismaスキーマのテストは、apps/api等の統合テストでカバー。スキーマバリデーションのみ検討。

---

## 実装順序（推奨）

```
Phase 1.1: packages/auth      ✅ 完了（カバレッジ99.14%）
Phase 1.2: packages/storage   ✅ 完了（カバレッジ100%）
Phase 2.1: apps/ws            ✅ 完了（カバレッジ99.31%）
Phase 3.1: packages/ui        ✅ 完了（カバレッジ100%）
Phase 3.2: apps/web           ← 次（ユーザー向けSPA）
Phase 3.3: apps/admin         ← 管理者向けSPA
```

---

## テスト戦略

### ユニットテスト

- **カバレッジ目標**: 80%（packages/sharedと統一）
- **フレームワーク**: Vitest（既存と統一）
- **モック戦略**: vi.mock()でDB・外部サービスをモック

### 統合テスト

- **データベース**: agentest_test（既存のテストDB使用）
- **外部サービス**: Docker Composeでローカル起動

### E2Eテスト（将来検討）

- **フレームワーク**: Playwright
- **対象**: クリティカルなユーザーフロー

---

## 各パッケージのvitest.config.ts テンプレート

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // フロントエンドは 'jsdom'
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

---

## 成功指標

- [ ] 全パッケージにvitest.config.ts設置
- [x] packages/auth: カバレッジ80%達成 (99.14%)
- [x] packages/storage: カバレッジ80%達成 (100%)
- [x] apps/ws: 主要機能のテストカバー (99.31%)
- [x] packages/ui: コンポーネントのレンダリングテスト完備 (100%)
- [ ] apps/web, apps/admin: カスタムフック・ユーティリティのテスト完備

---

## 次のアクション

1. ~~**packages/auth** のテスト環境構築~~ ✅ 完了
2. ~~**packages/storage** のテスト環境構築~~ ✅ 完了
3. ~~**apps/ws** のテスト環境構築~~ ✅ 完了
4. ~~**packages/ui** のテスト環境構築~~ ✅ 完了
5. **apps/web** のテスト環境構築
6. TDDワークフローで新機能開発を開始

---

*作成日: 2026-02-03*
*更新日: 2026-02-04* - packages/ui完了
