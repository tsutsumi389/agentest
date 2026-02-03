# テストスイート作成：モーダル → フォーム形式への変更

## 概要

テストスイートの作成機能を、現在のモーダル形式（`CreateTestSuiteModal`）からテストケース作成と同様のフォーム形式に変更する。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/test-suite/TestSuiteForm.tsx` | `mode: 'create'` 対応を追加 |
| `apps/web/src/pages/ProjectDetail.tsx` | URLパラメータ管理、フォーム表示、モーダル削除 |

## 実装内容

### 1. TestSuiteForm.tsx の変更

#### Props型の拡張

```typescript
// 変更前
interface TestSuiteFormProps {
  mode: 'edit';
  testSuite: TestSuite;
  preconditions: Precondition[];
  onSave: () => void;
  onCancel: () => void;
}

// 変更後
interface TestSuiteFormProps {
  mode: 'create' | 'edit';
  projectId: string;               // 追加
  testSuite?: TestSuite;           // オプショナルに変更
  preconditions?: Precondition[];  // オプショナルに変更
  onSave: (createdTestSuiteId?: string) => void;  // IDを返せるように変更
  onCancel: () => void;
}
```

#### 実装変更点

- 初期値: `mode === 'create'` 時は空の状態で開始
- ヘッダー: 「新規テストスイート作成」/「テストスイート編集」で切り替え
- 送信処理: 作成時は `testSuitesApi.create()` を使用し、作成されたIDを `onSave` に渡す
- 変更検知: 作成時は入力があれば変更ありと判定

### 2. ProjectDetail.tsx の変更

#### URLパラメータ管理の追加

```typescript
// 追加
import { useNavigate } from 'react-router';
import { TestSuiteForm } from '../components/test-suite/TestSuiteForm';

// 削除
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

// 追加
const navigate = useNavigate();
const isCreateMode = urlSearchParams.get('mode') === 'create';
```

#### ハンドラの追加

```typescript
// 作成モード開始
const handleStartCreateMode = useCallback(() => {
  const newParams = new URLSearchParams(urlSearchParams);
  newParams.set('tab', 'suites');
  newParams.set('mode', 'create');
  setUrlSearchParams(newParams);
}, [urlSearchParams, setUrlSearchParams]);

// 作成モード終了
const handleExitCreateMode = useCallback((createdTestSuiteId?: string) => {
  if (createdTestSuiteId) {
    navigate(`/test-suites/${createdTestSuiteId}`);
  } else {
    const newParams = new URLSearchParams(urlSearchParams);
    newParams.delete('mode');
    setUrlSearchParams(newParams);
  }
}, [urlSearchParams, setUrlSearchParams, navigate]);
```

#### タブ切り替え時の作成モード解除

`handleTabChange` に `newParams.delete('mode')` を追加

#### UIの変更

- ヘッダーの作成ボタン: `handleStartCreateMode` を呼び出すように変更
- タブコンテンツ: `isCreateMode` 時は `TestSuiteForm` を表示、それ以外は一覧を表示
- `CreateTestSuiteModal` コンポーネントを削除

## 動作フロー

1. 「テストスイート」ボタン → URL: `?tab=suites&mode=create`
2. フォーム表示（画面内、モーダルではない）
3. 作成完了 → 作成されたテストスイートの詳細画面へ遷移
4. キャンセル → URL: `?tab=suites` に戻り一覧表示

## 検証方法

1. **作成フロー**
   - プロジェクト詳細 > テストスイートタブで「テストスイート」ボタンをクリック
   - URLに `?mode=create` が付与されることを確認
   - フォームが画面内に表示される（モーダルではない）ことを確認
   - 名前を入力して作成 → テストスイート詳細画面へ遷移することを確認

2. **キャンセルフロー**
   - 「キャンセル」クリック → 一覧に戻ることを確認
   - 入力中にキャンセル → 確認ダイアログが表示されることを確認

3. **ブラウザ操作**
   - 入力中にブラウザ戻る → 確認ダイアログ表示
   - `?tab=suites&mode=create` で直接アクセス → フォーム表示
