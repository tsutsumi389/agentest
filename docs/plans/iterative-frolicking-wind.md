# セキュリティタブ - アクティブセッション表示上限の追加

## Context

セキュリティタブのアクティブセッション一覧は全件をDOMに描画している。セッション数が多い場合にページが長くなりUXが悪化する。デフォルトで表示件数を制限し、必要に応じて展開できるようにする。

## 変更対象

- `apps/web/src/pages/Settings.tsx`（フロントエンドのみ）

## 実装内容

### 1. 表示展開状態のstateを追加（L657付近）

```typescript
const [showAllSessions, setShowAllSessions] = useState(false);
```

### 2. 表示件数の定数を定義

```typescript
const INITIAL_SESSION_DISPLAY_COUNT = 5;
```

### 3. セッション一覧の描画を変更（L1130-1143）

ソート済みセッションに対して `.slice()` で表示件数を制限する：

```typescript
const sortedSessions = sessions.sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0));
const displayedSessions = showAllSessions
  ? sortedSessions
  : sortedSessions.slice(0, INITIAL_SESSION_DISPLAY_COUNT);
const hiddenCount = sessions.length - INITIAL_SESSION_DISPLAY_COUNT;
```

### 4. 「すべて表示」ボタンを追加

セッション一覧の下に、隠れているセッションがある場合にボタンを表示：

```tsx
{!showAllSessions && hiddenCount > 0 && (
  <button
    className="btn btn-ghost btn-sm w-full mt-3"
    onClick={() => setShowAllSessions(true)}
  >
    他 {hiddenCount} 件のセッションを表示
  </button>
)}
```

### 5. セッション削除時のリセット考慮

`handleRevokeSession` と `handleRevokeAllSessions` の後、セッション数が `INITIAL_SESSION_DISPLAY_COUNT` 以下になったら `showAllSessions` を `false` にリセットする。

## 検証方法

1. `docker compose exec dev pnpm build` でビルド確認
2. ブラウザで設定 > セキュリティタブを開き、セッション一覧の表示を確認
3. セッション数が5件以下の場合：ボタンが表示されないこと
4. セッション数が6件以上の場合：「他 N 件のセッションを表示」ボタンが表示されること
5. ボタン押下で全セッションが展開されること
