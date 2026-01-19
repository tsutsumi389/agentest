# ステータス変更後に実施者・実施日時が表示されない問題の修正

## 問題の原因

`apps/web/src/pages/Execution.tsx` の3つのmutation（前提条件・ステップ・期待結果）で：
1. **楽観的更新**で実施者情報を含めていない
2. **`onSuccess`コールバックがない**ため、APIレスポンスでキャッシュが更新されない

## 修正内容

**対象ファイル**: `apps/web/src/pages/Execution.tsx`

### 1. updatePreconditionMutation (97-130行付近)

`onSuccess`コールバックを追加し、APIレスポンスの`result`でキャッシュを更新：
```typescript
onSuccess: (data, { resultId }) => {
  const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);
  if (previousData) {
    queryClient.setQueryData(['execution', executionId, 'details'], {
      execution: {
        ...previousData.execution,
        preconditionResults: previousData.execution.preconditionResults.map((r) =>
          r.id === resultId ? data.result : r
        ),
      },
    });
  }
},
```

### 2. updateStepMutation (133-166行付近)

同様に`onSuccess`を追加：
```typescript
onSuccess: (data, { resultId }) => {
  // 同様のパターン
},
```

### 3. updateExpectedMutation (169-202行付近)

同様に`onSuccess`を追加：
```typescript
onSuccess: (data, { resultId }) => {
  // 同様のパターン
},
```

## 検証方法

1. 開発サーバーを起動
2. テスト実行画面を開く
3. 前提条件・ステップ・期待結果のステータスを変更
4. 実施者名とアバター、実施日時が表示されることを確認
5. エージェント経由の更新で「ユーザー名 (エージェント名経由)」形式で表示されることを確認
