# 通知のリアルタイム反映

## Context

通知がリアルタイムに反映されない問題を修正する。招待送信時など、通知生成時に即座にクライアントへ配信されるようにする。

### 根本原因

**問題1: WebSocket接続が確立されていない**
- `apps/web/src/stores/auth.ts:52-54` にコメントはあるが `wsClient.connect()` が未実装
- WebSocket接続が一度も確立されないため、リアルタイムイベントが届かない

**問題2: ユーザーチャンネルが購読されていない**
- `apps/web/src/hooks/useNotifications.ts` はイベントハンドラを登録しているが `wsClient.subscribe([Channels.user(userId)])` を呼んでいない
- 通知サービス (`notification.service.ts:109`) は `Channels.user(userId)` に発行するが、購読者がいない

### 通知配信フロー（理想）

```
API → notificationService.send() → DB保存 → Redis publish(user:{userId})
WSサーバー → Redis subscribe → channelSubscribers → クライアントに配信
フロントエンド → notification:received → ストア更新 + トースト表示
```

## 方針: クッキーベースWS自動認証 + ユーザーチャンネル自動購読

HttpOnlyクッキーはWebSocketのHTTPアップグレードリクエストで自動送信されるため、追加のAPI呼び出しなしでWS認証を実現できる。

---

## 変更内容

### 1. WSサーバー: クッキー解析 + 自動認証

**`apps/ws/src/auth.ts`** (+25行)

- `parseCookieToken(cookieHeader)`: Cookieヘッダーから`access_token`を抽出
- `authenticateFromCookie(cookieHeader)`: クッキーから認証（既存の`authenticateToken`を再利用）

**`apps/ws/src/server.ts`** (+40行, ~15行修正)

- `autoSubscribeUserChannel(ws)`: 認証済みユーザーの`user:{userId}`チャンネルを自動購読
  - 既存の`subscribeToChannel`、`channelSubscribers`を再利用
  - `Channels`は既に`@agentest/ws-types`からimport済み（handlers/execution.ts等で使用）
- `handleConnection`: `request.headers.cookie`からクッキー認証を試行
  - 成功: 即座に`authenticated`送信、auth timeoutスキップ、ユーザーチャンネル自動購読
  - 失敗: 既存のメッセージ認証フロー（fallback）
- `handleAuthenticate`: 既存のメッセージ認証成功後にも`autoSubscribeUserChannel`を呼ぶ

### 2. フロントエンド WSクライアント

**`apps/web/src/lib/ws.ts`** (~20行修正)

- `connect(token?)`: トークンを省略可能に変更
  - トークンあり: 既存のメッセージ認証
  - トークンなし: サーバーがクッキーで自動認証
- `useCookieAuth`フラグ追加: 再接続時の挙動制御
- `attemptReconnect()`: クッキー認証時はトークンなしで再接続
- `disconnect()`: `useCookieAuth`もリセット

### 3. フロントエンド 認証ストア

**`apps/web/src/stores/auth.ts`** (+6行)

WebSocket接続するタイミング（3箇所）:
- `initialize()`: `authApi.me()`成功後 → `wsClient.connect()` (AuthCallbackやページリロード時)
- `setUser()`: `wsClient.connect()` (メール/パスワードログイン時)
- `verify2FA()`: 検証成功後 → `wsClient.connect()` (2FAフロー)

### 4. 通知フック（変更なし）

**`apps/web/src/hooks/useNotifications.ts`** - 変更不要

サーバー側でユーザーチャンネルが自動購読されるため、既存のイベントハンドラ（`notification:received`、`notification:unread_count`）がそのまま動作する。

---

## 対象ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `apps/ws/src/auth.ts` | 関数追加 |
| `apps/ws/src/server.ts` | handleConnection修正、autoSubscribeUserChannel追加 |
| `apps/web/src/lib/ws.ts` | connect()修正、useCookieAuth追加 |
| `apps/web/src/stores/auth.ts` | initialize/setUser/verify2FAにWS接続追加 |

---

## テスト方針

### ユニットテスト

- **`apps/ws/src/__tests__/auth.test.ts`**: `parseCookieToken`、`authenticateFromCookie`のテスト
- **`apps/web/src/lib/__tests__/ws.test.ts`**: トークンなし接続、クッキー認証再接続のテスト

### 統合テスト

- **`apps/ws/src/__tests__/integration/ws-connection.integration.test.ts`**: クッキー認証、自動購読、フォールバックのテスト

### 手動検証

1. ログイン → DevToolsのNetworkタブでWebSocket接続確認
2. 別ブラウザで招待送信 → 通知トースト表示 + 未読バッジ更新を確認
3. ページリロード後の再接続確認
4. ログアウト時のWS切断確認

---

## リスクと対策

| リスク | 対策 |
|-------|------|
| `sameSite: 'strict'`でWSサーバーにクッキーが届かない | 開発環境は同一`localhost`で問題なし。本番はAPI/WSを同一ドメインで運用 |
| アクセストークン期限切れ(15分)後の再接続失敗 | WSサーバーがクッキー認証失敗→メッセージ認証タイムアウト→クライアントが再接続停止。次のAPI呼び出しでクッキー自動リフレッシュ後、ページ操作で復帰 |
| 既存メッセージ認証への影響 | クッキー認証は前段のみ。失敗時は既存フローにfallback。`ALREADY_AUTHENTICATED`チェックで二重認証を防止 |
