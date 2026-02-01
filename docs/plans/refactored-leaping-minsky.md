# 管理者アカウント一覧（ADM-SEC-001）詳細仕様書

## 概要

システム管理者アカウントの一覧・詳細・作成・編集・削除機能を提供する。
**SUPER_ADMIN権限を持つ管理者のみ**がアクセス可能。

---

## 1. API仕様

### 1.1 GET /admin/admin-users - 管理者一覧API

全システム管理者の一覧を検索・フィルタリングして取得する。

#### 認証

Cookie認証が必要。SUPER_ADMIN権限必須。

```
Cookie: admin_session=<session_id>
```

#### リクエストパラメータ（Query）

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `q` | string | - | メール・名前で部分一致検索（最大100文字） |
| `role` | string | - | ロール（SUPER_ADMIN,ADMIN,VIEWER）カンマ区切り |
| `status` | enum | `active` | active / deleted / locked / all |
| `totpEnabled` | boolean | - | 2FA有効状態でフィルタ |
| `createdFrom` | datetime | - | 登録日From（ISO 8601形式） |
| `createdTo` | datetime | - | 登録日To（ISO 8601形式） |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1ページあたり件数（max: 100） |
| `sortBy` | enum | `createdAt` | createdAt / name / email / role / lastLoginAt |
| `sortOrder` | enum | `desc` | asc / desc |

#### レスポンス (200 OK)

```json
{
  "adminUsers": [
    {
      "id": "admin_abc123",
      "email": "admin@example.com",
      "name": "管理者太郎",
      "role": "SUPER_ADMIN",
      "totpEnabled": true,
      "failedAttempts": 0,
      "lockedUntil": null,
      "createdAt": "2024-01-15T12:00:00.000Z",
      "updatedAt": "2024-06-01T09:30:00.000Z",
      "deletedAt": null,
      "activity": {
        "lastLoginAt": "2024-06-15T10:00:00.000Z",
        "activeSessionCount": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 1.2 GET /admin/admin-users/:id - 管理者詳細API

指定した管理者の詳細情報を取得する。

#### レスポンス (200 OK)

```json
{
  "adminUser": {
    "id": "admin_abc123",
    "email": "admin@example.com",
    "name": "管理者太郎",
    "role": "SUPER_ADMIN",
    "totpEnabled": true,
    "failedAttempts": 0,
    "lockedUntil": null,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-06-01T09:30:00.000Z",
    "deletedAt": null,
    "activity": {
      "lastLoginAt": "2024-06-15T10:00:00.000Z",
      "activeSessionCount": 1,
      "currentSessions": [
        {
          "id": "session_xyz",
          "ipAddress": "192.168.1.1",
          "userAgent": "Mozilla/5.0...",
          "lastActiveAt": "2024-06-15T10:00:00.000Z",
          "createdAt": "2024-06-15T08:00:00.000Z"
        }
      ]
    },
    "recentAuditLogs": [
      {
        "id": "log_123",
        "action": "LOGIN",
        "targetType": null,
        "targetId": null,
        "ipAddress": "192.168.1.1",
        "createdAt": "2024-06-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 1.3 POST /admin/admin-users - 管理者招待API

新しい管理者を招待する。招待メールが送信される。

#### リクエストボディ

```json
{
  "email": "new-admin@example.com",
  "name": "新しい管理者",
  "role": "ADMIN"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `email` | Yes | string | メールアドレス（最大255文字） |
| `name` | Yes | string | 表示名（最大100文字） |
| `role` | Yes | enum | SUPER_ADMIN / ADMIN / VIEWER |

#### レスポンス (201 Created)

```json
{
  "adminUser": {
    "id": "admin_new123",
    "email": "new-admin@example.com",
    "name": "新しい管理者",
    "role": "ADMIN",
    "totpEnabled": false,
    "createdAt": "2024-06-15T12:00:00.000Z"
  },
  "invitationSent": true
}
```

---

### 1.4 PATCH /admin/admin-users/:id - 管理者編集API

管理者情報を更新する。

#### リクエストボディ

```json
{
  "name": "更新後の名前",
  "role": "VIEWER"
}
```

#### レスポンス (200 OK)

```json
{
  "adminUser": {
    "id": "admin_abc123",
    "email": "admin@example.com",
    "name": "更新後の名前",
    "role": "VIEWER",
    "totpEnabled": true,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-06-15T12:00:00.000Z"
  }
}
```

---

### 1.5 DELETE /admin/admin-users/:id - 管理者削除API

管理者を論理削除する。

#### レスポンス (200 OK)

```json
{
  "message": "管理者を削除しました",
  "deletedAt": "2024-06-15T12:00:00.000Z"
}
```

---

### 1.6 POST /admin/admin-users/:id/unlock - アカウントロック解除API

ロックされた管理者アカウントのロックを解除する。

---

### 1.7 POST /admin/admin-users/:id/reset-2fa - 2FAリセットAPI

管理者の2FA設定をリセットする（紛失時の復旧用）。

---

## 2. エラーコード一覧

| コード | ステータス | 説明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 認証されていない |
| FORBIDDEN | 403 | SUPER_ADMIN権限がない |
| NOT_FOUND | 404 | 管理者が存在しない |
| ADMIN_USER_ALREADY_EXISTS | 409 | メールアドレスが既に登録済み |
| CANNOT_DELETE_SELF | 400 | 自分自身は削除不可 |
| CANNOT_DELETE_LAST_SUPER_ADMIN | 400 | 最後のSUPER_ADMINは削除不可 |
| CANNOT_EDIT_SELF_ROLE | 400 | 自分自身のロールは変更不可 |
| CANNOT_DEMOTE_LAST_SUPER_ADMIN | 400 | 最後のSUPER_ADMINのロール変更不可 |

---

## 3. ビジネスルール

### 3.1 削除制約

| ルール | 説明 |
|--------|------|
| 自己削除禁止 | 自分自身のアカウントは削除不可 |
| 最後のSUPER_ADMIN保護 | アクティブなSUPER_ADMINが1人の場合、そのアカウントは削除不可 |

### 3.2 ロール変更制約

| ルール | 説明 |
|--------|------|
| 自己ロール変更禁止 | 自分自身のロールは変更不可 |
| 最後のSUPER_ADMIN降格禁止 | アクティブなSUPER_ADMINが1人の場合、ロール変更不可 |

### 3.3 招待フロー

1. SUPER_ADMINが招待APIを実行
2. 仮パスワードが生成され、DBに保存（bcryptハッシュ化）
3. 招待メールが送信（仮パスワード含む）
4. 新管理者が初回ログイン
5. パスワード変更を強制（初回ログインフラグ）
6. 2FAセットアップを推奨

---

## 4. フロントエンド仕様

### 4.1 管理者一覧画面

#### 画面構成

```
+--------------------------------------------------+
| [アイコン] システム管理者一覧                [更新] |
| 管理者アカウントの管理                             |
+--------------------------------------------------+
| [検索入力欄: メール・名前で検索]                   |
| ロール: [全て▼] ステータス: [有効▼] 2FA: [全て▼]  |
| 期間: [開始日] ~ [終了日]           [クリア]       |
+--------------------------------------------------+
|                                                  |
| 名前 ▼ | メール | ロール | 2FA | 状態 | 登録日    |
|--------|--------|--------|-----|------|----------|
| 管理者A | a@...  | SUPER  | ✓   | 有効 | 2024/01  |
| 管理者B | b@...  | ADMIN  | ✗   | 有効 | 2024/02  |
| 管理者C | c@...  | VIEWER | ✓   | ロック| 2024/03 |
|--------|--------|--------|-----|------|----------|
|                                    [< 1/1 >]     |
+--------------------------------------------------+
| [+ 管理者を招待]                                  |
+--------------------------------------------------+
```

#### テーブル列定義

| 列名 | 表示 | ソート | 説明 |
|------|------|--------|------|
| name | 名前 | ○ | 表示名 |
| email | メール | ○ | メールアドレス |
| role | ロール | ○ | バッジ表示（SUPER_ADMIN: 赤, ADMIN: 青, VIEWER: グレー） |
| totpEnabled | 2FA | - | アイコン（有効/無効） |
| status | 状態 | - | 有効/削除済み/ロック中 |
| createdAt | 登録日 | ○ | 相対時間表示 |
| actions | - | - | 詳細・編集・削除ボタン |

### 4.2 管理者招待モーダル

- メールアドレス入力（必須）
- 名前入力（必須）
- ロール選択（ラジオボタン: SUPER_ADMIN / ADMIN / VIEWER）

### 4.3 管理者詳細画面

- **ヘッダー**: 名前、ロールバッジ、2FAステータス、操作ボタン
- **基本情報セクション**: メール、作成日、更新日
- **アクティビティセクション**: 最終ログイン、アクティブセッション一覧
- **操作履歴セクション**: 最近の監査ログ10件

---

## 5. キャッシュ戦略

| 対象 | TTL | キャッシュキー | 無効化タイミング |
|------|-----|---------------|-----------------|
| 一覧 | 60秒 | `admin:admin-users:${paramsHash}` | 作成/更新/削除時 |
| 詳細 | 30秒 | `admin:admin-user:detail:${id}` | 対象の更新/削除時 |

---

## 6. 監査ログ記録

| アクション | 記録内容 |
|-----------|---------|
| ADMIN_USER_LIST | 一覧閲覧（検索条件） |
| ADMIN_USER_VIEW | 詳細閲覧（対象ID） |
| ADMIN_USER_CREATE | 作成（メール、ロール） |
| ADMIN_USER_UPDATE | 更新（変更前後の値） |
| ADMIN_USER_DELETE | 削除（対象ID） |
| ADMIN_USER_UNLOCK | ロック解除（対象ID） |
| ADMIN_USER_RESET_2FA | 2FAリセット（対象ID） |

---

## 7. 実装対象ファイル

### バックエンド（新規作成）

| ファイル | 説明 |
|---------|------|
| `apps/api/src/routes/admin/admin-users.ts` | ルーティング定義 |
| `apps/api/src/controllers/admin/admin-users.controller.ts` | コントローラー |
| `apps/api/src/services/admin/system-admin.service.ts` | サービス |

### 共通（追加）

| ファイル | 説明 |
|---------|------|
| `packages/shared/src/types/system-admin.ts` | 型定義 |
| `packages/shared/src/validators/schemas.ts` | Zodスキーマ追加 |

### フロントエンド（新規作成）

| ファイル | 説明 |
|---------|------|
| `apps/admin/src/pages/SystemAdmins.tsx` | 一覧ページ |
| `apps/admin/src/pages/SystemAdminDetail.tsx` | 詳細ページ |
| `apps/admin/src/components/system-admins/SystemAdminTable.tsx` | テーブル |
| `apps/admin/src/components/system-admins/SystemAdminFilters.tsx` | フィルター |
| `apps/admin/src/components/system-admins/SystemAdminSearchForm.tsx` | 検索フォーム |
| `apps/admin/src/components/system-admins/SystemAdminInviteModal.tsx` | 招待モーダル |
| `apps/admin/src/components/system-admins/SystemAdminRoleBadge.tsx` | ロールバッジ |
| `apps/admin/src/hooks/useSystemAdmins.ts` | データ取得フック |

### 参考ファイル（既存パターン）

| ファイル | 参考用途 |
|---------|---------|
| `apps/api/src/services/admin/admin-users.service.ts` | サービス層パターン |
| `apps/admin/src/pages/Users.tsx` | 一覧ページパターン |
| `docs/api/admin-users.md` | API仕様フォーマット |

---

## 8. 検証方法

### 単体テスト

- サービス層のビジネスロジック（削除制約、ロール変更制約）
- Zodバリデーションスキーマ

### 統合テスト

1. 管理者一覧取得（検索・フィルタ・ソート・ページネーション）
2. 管理者詳細取得
3. 管理者招待 → メール送信確認
4. 管理者編集（ロール変更制約の確認）
5. 管理者削除（自己削除禁止、最後のSUPER_ADMIN保護）
6. アカウントロック解除
7. 2FAリセット

### E2Eテスト

1. SUPER_ADMINでログイン → 管理者一覧画面表示
2. 検索・フィルタ操作
3. 管理者招待モーダル → 招待実行
4. 管理者詳細画面遷移 → 編集・削除操作
5. ADMIN/VIEWERでアクセス → 403エラー確認

---

## 9. 実装順序

1. **Phase 1**: 型定義・Zodスキーマ追加（packages/shared）
2. **Phase 2**: バックエンドAPI実装（routes → controller → service）
3. **Phase 3**: フロントエンド実装（hooks → components → pages）
4. **Phase 4**: テスト作成・実行
5. **Phase 5**: API仕様ドキュメント作成（docs/api/admin-admin-users.md）
