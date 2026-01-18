# ラベルUI統合 実装計画

## 概要
既存のラベルコンポーネント（LabelList, LabelSelector, LabelBadge）をプロジェクト設定ページとテストスイート詳細ページに統合する。

## 現状
- ✅ APIクライアント（labelsApi）: 完全実装済み
- ✅ UIコンポーネント: LabelBadge, LabelSelector, LabelFormModal, LabelList 実装済み
- ❌ プロジェクト設定ページへの統合: 未実装
- ❌ テストスイート詳細ページへの統合: 未実装

---

## 実装タスク

### Task 1: プロジェクト設定ページにラベル管理UI追加

**対象ファイル:** `apps/web/src/components/project/ProjectSettingsTab.tsx`

**変更内容:**
1. `SettingsSection` 型に `'labels'` を追加
2. `Tags` アイコンをインポート
3. タブ配列に「ラベル」タブを追加（environments の後、history の前）
4. ラベル管理セクション用の `LabelManagementSection` コンポーネントを同ファイルに追加
   - `useQuery` で `labelsApi.getByProject` を呼び出し
   - `useMutation` で作成・更新・削除を処理
   - `LabelList` コンポーネントをラップ
5. `activeSection === 'labels'` の条件分岐を追加

**実装例:**
```typescript
// 型に追加
export type SettingsSection = 'general' | 'members' | 'environments' | 'labels' | 'history' | 'danger';

// タブに追加
{ id: 'labels' as const, label: 'ラベル', icon: Tags },
```

---

### Task 2: テストスイート詳細ページの設定タブにラベル選択機能追加

**対象ファイル:** `apps/web/src/pages/TestSuiteCases.tsx`

**変更内容:**
1. `SettingsTab` コンポーネントを拡張
   - props に `projectId` を追加
   - `useQuery` で `labelsApi.getByProject` と `labelsApi.getByTestSuite` を呼び出し
   - `useMutation` で `labelsApi.updateTestSuiteLabels` を処理
2. ラベルセクションを追加
   - 「ラベル」セクションタイトル
   - `LabelSelector` コンポーネントで選択UI
   - 保存ボタン（変更があった場合のみ有効化）
3. 削除セクションはその下に移動

**UI構成:**
```
┌─────────────────────────────────┐
│ ラベル                          │
│ ┌─────────────────────────────┐ │
│ │ [LabelSelector]             │ │
│ └─────────────────────────────┘ │
│ [保存]                          │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 危険な操作                      │
│ [削除ボタン...]                 │
└─────────────────────────────────┘
```

---

### Task 3: テストスイートヘッダーにラベルバッジ表示

**対象ファイル:** `apps/web/src/components/test-suite/TestSuiteHeader.tsx`

**変更内容:**
1. `LabelBadgeList` をインポート
2. `TestSuiteHeaderProps` に `labels?: Label[]` を追加
3. テストスイート名の下（157行目あたり）にラベルバッジを表示
   - 条件: `labels && labels.length > 0` のとき表示
   - `LabelBadgeList` コンポーネントを使用

**対象ファイル:** `apps/web/src/pages/TestSuiteCases.tsx`

**変更内容:**
1. `useQuery` で `labelsApi.getByTestSuite` を呼び出し
2. `TestSuiteHeader` に `labels` props を渡す

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/project/ProjectSettingsTab.tsx` | ラベル管理セクション追加 |
| `apps/web/src/pages/TestSuiteCases.tsx` | ラベル取得・設定タブ拡張・ヘッダーへのprops追加 |
| `apps/web/src/components/test-suite/TestSuiteHeader.tsx` | ラベルバッジ表示追加 |

---

## 検証方法

1. **プロジェクト設定ページ**
   - `/projects/{projectId}?tab=settings&section=labels` でラベル管理画面が表示される
   - ラベルの作成・編集・削除ができる
   - トーストで成功・エラーメッセージが表示される

2. **テストスイート詳細ページ**
   - ヘッダーに付与されたラベルがバッジ表示される
   - 設定タブでラベルの追加・削除ができる
   - 保存後、ヘッダーのバッジ表示が即座に反映される
