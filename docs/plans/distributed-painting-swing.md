# PiP機能改善 実装計画

## 概要
テスト実行のPiP（Picture-in-Picture）機能を改善し、表示フローの変更、ステータスUIの変更、テストケース間ナビゲーションの追加、サイズ調整を行う。

## 変更要件

1. **表示フローの変更**: テストスイート前提条件→テストケース前提条件→ステップ→期待結果の順序
2. **ステータスUIの変更**: ドロップダウンからボタンに変更
3. **テストケース間ナビゲーション**: 次/前のテストケースへのボタン追加
4. **PiPの高さ**: 400px → 600px

## ユーザー確認事項
- テストスイート前提条件: **最初のテストケースでのみ表示**
- PiP高さ: **600px**

---

## 実装ステップ

### Step 1: NavigableItem型の拡張
**ファイル**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

```typescript
// 現在
type: 'step' | 'expected'

// 変更後
type: 'suite-precondition' | 'case-precondition' | 'step' | 'expected'
```

### Step 2: PipExecutionPanelPropsの拡張
**ファイル**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

追加するprops:
- `suitePreconditions`: スイートレベル前提条件スナップショット
- `casePreconditions`: テストケースレベル前提条件スナップショット
- `preconditionResults`: 前提条件結果
- `onPreconditionStatusChange`: 前提条件ステータス変更ハンドラ
- `onPreconditionNoteChange`: 前提条件ノート変更ハンドラ
- `updatingPreconditionStatusId`, `updatingPreconditionNoteId`
- `testCases`: 全テストケース一覧
- `currentTestCaseIndex`: 現在のテストケースインデックス
- `totalTestCases`: 全テストケース数
- `onNavigateToTestCase`: テストケース切り替えハンドラ
- `isFirstTestCase`: 最初のテストケースかどうか（スイート前提条件表示判定用）

### Step 3: PipStatusButtonsコンポーネントの作成
**ファイル**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

`<select>`要素の代わりにボタングループを作成:

```typescript
function PipStatusButtons<T extends string>({
  value,
  options,
  onChange,
  isEditable,
  isUpdating,
}: {
  value: T;
  options: StatusOption<T>[];
  onChange: (value: T) => void;
  isEditable: boolean;
  isUpdating: boolean;
})
```

ステータス種別ごとのオプション:
- 前提条件: `UNCHECKED` / `MET` / `NOT_MET`
- ステップ: `PENDING` / `DONE` / `SKIPPED`
- 期待結果: `PENDING` / `PASS` / `FAIL` / `SKIPPED` / `NOT_EXECUTABLE`

### Step 4: navigableItems構築ロジックの変更
**ファイル**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

表示順序:
1. スイートレベル前提条件（最初のテストケースのみ）
2. テストケースレベル前提条件
3. ステップ
4. 期待結果

### Step 5: テストケースナビゲーションUIの追加
**ファイル**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

ヘッダーに追加:
- 「< 前へ」ボタン（前のテストケースへ）
- 「テストケース X / Y」表示
- 「次へ >」ボタン（次のテストケースへ）

### Step 6: Execution.tsxの変更
**ファイル**: `apps/web/src/pages/Execution.tsx`

変更点:
1. PiPサイズを600pxに変更
2. ソート済みテストケースリストを計算
3. 現在のテストケースインデックスを計算
4. PipExecutionPanelに新しいpropsを渡す

```typescript
const { pipWindow, isPipSupported, isPipActive, openPip, closePip } = usePictureInPicture({
  width: 450,
  height: 600, // 400 → 600
});
```

### Step 7: アイテム種類表示の改善
**ファイル**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

種類ごとのラベルとスタイル:
- `suite-precondition`: 「スイート前提条件」（紫系）
- `case-precondition`: 「ケース前提条件」（紫系）
- `step`: 「ステップ」（青系）
- `expected`: 「期待結果」（緑系）

---

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/execution/PipExecutionPanel.tsx` | メイン変更: 型拡張、ステータスボタン、ナビゲーションUI |
| `apps/web/src/pages/Execution.tsx` | props拡張、サイズ変更、テストケースナビゲーションロジック |
| `apps/web/src/lib/execution-status.ts` | 参照のみ（既存の`preconditionResultStatusOptions`を使用） |

---

## 検証方法

### 機能テスト
1. **表示フロー確認**
   - PiPを開き、最初のテストケースでスイート前提条件→ケース前提条件→ステップ→期待結果の順で表示
   - 2番目以降のテストケースではスイート前提条件がスキップされること

2. **ステータスボタン動作**
   - 各アイテム種類でステータスボタンをクリックして変更できること
   - 更新中のローディング表示
   - 編集不可時はボタンがdisabled

3. **テストケースナビゲーション**
   - 「次へ」「前へ」ボタンでテストケースを切り替え
   - 最初/最後のテストケースでボタンがdisabled
   - 親ウィンドウのサイドバー選択状態も同期

4. **サイズ確認**
   - PiPウィンドウが450x600pxで表示

### エッジケース
- 前提条件がないテストケース
- テストケースが1件のみの場合
- スイート前提条件がない場合
