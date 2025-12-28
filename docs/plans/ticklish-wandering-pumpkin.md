# Phase 3: プロジェクト管理 実装計画

## 概要

テスト管理のコンテナとなるプロジェクト管理機能を完成させる。基本的なCRUDは実装済みのため、不足機能を追加実装する。

## 対象機能

| ID | 機能 | 現状 | 追加実装 |
|-----|------|------|----------|
| PRJ-001 | プロジェクト作成 | ✓実装済 | 組織選択UI追加 |
| PRJ-003 | プロジェクト設定 | 未実装 | 設定ページ新規作成 |
| PRJ-007 | 環境設定 | 部分実装 | 更新・削除・並替API + UI |
| PRJ-002 | プロジェクト一覧 | ✓実装済 | フィルタ拡張 |
| PRJ-006 | プロジェクト検索 | 部分実装 | 組織フィルタ追加 |
| PRJ-004 | 変更履歴 | 未実装 | 履歴API + UI |
| PRJ-005 | 論理削除 | 部分実装 | 復元API + UI |

---

## 実装順序

### Step 1: プロジェクト設定ページ基盤（PRJ-003）

**バックエンド - 変更なし**（基本APIは実装済み）

**フロントエンド**

1. `apps/web/src/pages/ProjectSettings.tsx` - 新規作成
   - タブ構成: 一般 / メンバー / 環境 / 履歴 / 危険な操作
   - OrganizationSettings.tsxをパターンとして実装

2. `apps/web/src/App.tsx` - ルート追加
   ```
   /projects/:projectId/settings → ProjectSettingsPage
   ```

3. `apps/web/src/pages/ProjectDetail.tsx` - 設定リンク追加

4. `apps/web/src/components/project/` - ディレクトリ作成
   - `ProjectGeneralSettings.tsx` - 名前・説明編集
   - `ProjectMemberList.tsx` - メンバー一覧・管理
   - `AddProjectMemberModal.tsx` - メンバー追加モーダル

---

### Step 2: 環境管理（PRJ-007）

**バックエンド**

1. `apps/api/src/routes/projects.ts` - ルート追加
   ```
   PATCH /:projectId/environments/:environmentId  (更新)
   DELETE /:projectId/environments/:environmentId (削除)
   POST /:projectId/environments/reorder          (並替)
   ```

2. `apps/api/src/services/project.service.ts` - メソッド追加
   - `updateEnvironment()` - デフォルト切替ロジック含む
   - `deleteEnvironment()` - 実行中テスト使用チェック
   - `reorderEnvironments()` - sortOrder一括更新

3. `apps/api/src/controllers/project.controller.ts` - ハンドラ追加

4. `packages/shared/src/validators/schemas.ts` - スキーマ追加
   - `projectEnvironmentCreateSchema`
   - `projectEnvironmentUpdateSchema`

**フロントエンド**

1. `apps/web/src/components/project/EnvironmentList.tsx` - 新規作成
   - 環境一覧表示
   - デフォルト切替ボタン
   - 編集・削除ボタン

2. `apps/web/src/components/project/EnvironmentFormModal.tsx` - 新規作成
   - 環境作成/編集フォーム

3. `apps/web/src/lib/api.ts` - API追加
   - `updateEnvironment`, `deleteEnvironment`, `reorderEnvironments`

---

### Step 3: 一覧・検索拡張（PRJ-002, PRJ-006）

**バックエンド**

1. `apps/api/src/services/user.service.ts` - 検索オプション拡張
   - `q`: 名前部分一致
   - `organizationId`: 組織フィルタ
   - `includeDeleted`: 削除済み含む

**フロントエンド**

1. `apps/web/src/pages/Projects.tsx` - 拡張
   - 組織フィルタードロップダウン追加
   - 削除済みプロジェクト表示切替
   - 削除済みカードのグレーアウト表示

2. `CreateProjectModal` - 組織選択追加
   - 個人/組織の切替UI
   - 組織ドロップダウン（useOrganization()から取得）

---

### Step 4: 履歴・削除・復元（PRJ-004, PRJ-005）

**バックエンド**

1. `apps/api/src/routes/projects.ts` - ルート追加
   ```
   GET /:projectId/histories                    (履歴取得)
   POST /:projectId/restore                     (復元)
   ```

2. `apps/api/src/services/project.service.ts` - メソッド追加
   - `createHistory()` - 作成/更新/削除時に呼び出し
   - `getHistories()` - 履歴一覧取得
   - `restore()` - 30日以内チェック付き復元

3. 既存メソッド修正
   - `create()`, `update()`, `softDelete()` に履歴作成を追加

4. `apps/api/src/repositories/project.repository.ts` - メソッド追加
   - `findDeletedById()`
   - `restore()`

**フロントエンド**

1. `apps/web/src/components/project/HistoryList.tsx` - 新規作成
   - タイムライン形式で変更履歴表示
   - 変更者アバター・名前
   - 変更タイプアイコン

2. `apps/web/src/components/project/DeleteProjectSection.tsx` - 新規作成
   - 削除ボタン + 確認ダイアログ
   - 復元ボタン（削除済みの場合）
   - 完全削除までの残り日数表示

3. `apps/web/src/lib/api.ts` - API追加
   - `getHistories`, `restore`

---

## ファイル一覧

### 新規作成

| ファイル | 説明 |
|----------|------|
| `apps/web/src/pages/ProjectSettings.tsx` | プロジェクト設定ページ |
| `apps/web/src/components/project/ProjectGeneralSettings.tsx` | 一般設定タブ |
| `apps/web/src/components/project/ProjectMemberList.tsx` | メンバー一覧 |
| `apps/web/src/components/project/AddProjectMemberModal.tsx` | メンバー追加モーダル |
| `apps/web/src/components/project/EnvironmentList.tsx` | 環境一覧 |
| `apps/web/src/components/project/EnvironmentFormModal.tsx` | 環境フォーム |
| `apps/web/src/components/project/HistoryList.tsx` | 変更履歴 |
| `apps/web/src/components/project/DeleteProjectSection.tsx` | 削除セクション |

### 修正

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/routes/projects.ts` | 環境更新/削除/並替、履歴、復元ルート追加 |
| `apps/api/src/controllers/project.controller.ts` | 新規ハンドラ追加 |
| `apps/api/src/services/project.service.ts` | 環境管理、履歴、復元メソッド追加 |
| `apps/api/src/repositories/project.repository.ts` | 復元、削除済み取得メソッド追加 |
| `packages/shared/src/validators/schemas.ts` | 環境スキーマ追加 |
| `apps/web/src/App.tsx` | 設定ページルート追加 |
| `apps/web/src/lib/api.ts` | 新規API関数・型追加 |
| `apps/web/src/pages/Projects.tsx` | 組織選択、フィルタ拡張 |
| `apps/web/src/pages/ProjectDetail.tsx` | 設定リンク追加 |

---

## テスト計画

各Stepの実装後に以下を確認:

1. **Step 1**: 設定ページ表示、名前・説明編集、メンバー管理
2. **Step 2**: 環境CRUD、デフォルト切替、sortOrder更新
3. **Step 3**: 検索・フィルタ動作、組織選択でのプロジェクト作成
4. **Step 4**: 履歴表示、削除・復元フロー、30日制限

---

## 権限マトリクス

| 操作 | Owner | ADMIN | WRITE | READ |
|------|:-----:|:-----:|:-----:|:----:|
| 設定変更 | ✓ | ✓ | - | - |
| メンバー管理 | ✓ | ✓ | - | - |
| 環境作成/編集 | ✓ | ✓ | ✓ | - |
| 環境削除 | ✓ | ✓ | - | - |
| 履歴閲覧 | ✓ | ✓ | ✓ | ✓ |
| プロジェクト削除 | ✓ | ✓ | - | - |
| プロジェクト復元 | ✓ | ✓ | - | - |
