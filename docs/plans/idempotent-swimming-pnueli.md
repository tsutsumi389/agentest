# プロジェクト新規作成のコンテキスト連動化

## Context

現在、プロジェクト一覧ページでは「すべて」「個人」「組織」のフィルターがあるが、新規プロジェクト作成モーダルでは毎回「個人/組織」の所有者選択が必要。
ユーザーの要望として、「すべて」フィルターを廃止し、個人 or 組織ごとの一覧を表示するようにした上で、表示中のコンテキストに応じて自動的に対応するプロジェクトを作成するようにする。

## 変更対象ファイル

1. `apps/web/src/pages/Projects.tsx` - プロジェクト一覧ページ
2. `apps/web/src/components/project/CreateProjectModal.tsx` - プロジェクト作成モーダル

## 変更内容

### 1. `Projects.tsx` - フィルターから「すべて」を削除

- `OrganizationFilter` 型から `'all'` を削除 → `'personal' | string`
- デフォルト値を `'personal'` に変更
- `<select>` から `<option value="all">すべて</option>` を削除
- `apiOrganizationId` の計算を簡略化（`'all'` 分岐を除去）
- `CreateProjectModal` に現在のフィルターコンテキストを props で渡す
  - `organizationFilter === 'personal'` → `organizationId={undefined}`
  - `organizationFilter === orgId` → `organizationId={orgId}`

### 2. `CreateProjectModal.tsx` - 所有者選択UIを削除

- props に `organizationId?: string` を追加
- `ownerType` state と所有者選択UI（個人/組織ボタン）を削除
- 組織選択ドロップダウンを削除
- `organizationId` prop が渡されればそれを使用し、なければ個人プロジェクトとして作成
- モーダルタイトルを動的に変更: 「新規プロジェクト（個人）」「新規プロジェクト（{組織名}）」
- 不要な import (`User`, `Building2`, `useOrganizationStore`) を削除

## 検証方法

1. Docker 環境でビルド確認: `docker compose exec dev pnpm build`
2. ブラウザで動作確認:
   - フィルターで「個人プロジェクト」を選択 → 「新規プロジェクト」クリック → 個人プロジェクトとして作成されること
   - フィルターで組織を選択 → 「新規プロジェクト」クリック → その組織のプロジェクトとして作成されること
   - 「すべて」フィルターが表示されないこと
