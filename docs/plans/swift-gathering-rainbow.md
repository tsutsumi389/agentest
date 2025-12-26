# Phase 1: 認証基盤 - 詳細実装計画

## 概要

Phase 1 では、システムの土台となるユーザー認証機能を構築する。

| 順序 | 機能 | ID | 説明 |
|:---:|------|-----|------|
| 1 | ユーザー登録・OAuth認証 | USR-001, AU-001 | GitHub/Google OAuth でアカウント作成・ログイン |
| 2 | プロフィール設定 | USR-002 | 表示名、アバター、メール設定 |
| 3 | セッション管理 | USR-005 | アクティブセッションの確認・無効化 |

---

## 現状分析

### 実装済み
- ✅ OAuth 認証フロー（GitHub/Google）
- ✅ JWT トークン発行・検証（RS256）
- ✅ HttpOnly Cookie によるトークン管理
- ✅ ユーザー CRUD API
- ✅ DB スキーマ（User, Account, Session, RefreshToken）
- ✅ ログイン/コールバックページ

### 未実装
- ❌ プロフィール更新の Web 層 API 呼び出し
- ❌ セッション管理 API（一覧・削除）
- ❌ セッション管理 UI
- ❌ OAuth 連携追加・解除
- ❌ 監査ログ記録

---

## 1. ユーザー登録・OAuth認証（USR-001, AU-001）

### 1.1 現状
OAuth 認証フローは完成済み。以下のエンドポイントが稼働：

```
GET  /api/auth/github          # GitHub OAuth 開始
GET  /api/auth/github/callback # GitHub OAuth コールバック
GET  /api/auth/google          # Google OAuth 開始
GET  /api/auth/google/callback # Google OAuth コールバック
GET  /api/auth/me              # 現在のユーザー情報
POST /api/auth/refresh         # トークンリフレッシュ
POST /api/auth/logout          # ログアウト
```

### 1.2 追加実装

#### API エンドポイント
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/users/:userId/accounts` | OAuth 連携一覧取得 |
| POST | `/api/users/:userId/accounts/:provider` | OAuth 連携追加 |
| DELETE | `/api/users/:userId/accounts/:provider` | OAuth 連携解除 |

#### ビジネスルール
- 最低1つの OAuth 連携は必須（解除時にチェック）
- 同一プロバイダーの重複連携は不可
- 連携解除時は確認ダイアログを表示

---

## 2. プロフィール設定（USR-002）

### 2.1 DB スキーマ（実装済み）

```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique @db.VarChar(255)
  name      String    @db.VarChar(100)
  avatarUrl String?   @map("avatar_url")
  plan      UserPlan  @default(FREE)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
}
```

### 2.2 API エンドポイント（実装済み）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/users/:userId` | ユーザー詳細取得 |
| PUT | `/api/users/:userId` | プロフィール更新 |
| DELETE | `/api/users/:userId` | アカウント削除（論理削除） |

#### リクエスト/レスポンス

```typescript
// PUT /api/users/:userId
// Request
{
  "name": "表示名",
  "avatarUrl": "https://example.com/avatar.png" | null
}

// Response
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "表示名",
    "avatarUrl": "https://example.com/avatar.png",
    "plan": "FREE",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

### 2.3 フロントエンド実装

#### 対象ファイル
- `apps/web/src/pages/Settings.tsx`

#### 実装内容
1. API クライアント呼び出しの実装
2. 保存成功/失敗時のトースト通知
3. バリデーションエラー表示
4. ローディング状態の表示

---

## 3. セッション管理（USR-005）

### 3.1 DB スキーマ（実装済み）

```prisma
model Session {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  token        String    @unique @db.VarChar(500)
  userAgent    String?   @map("user_agent")
  ipAddress    String?   @map("ip_address") @db.VarChar(45)
  lastActiveAt DateTime  @default(now()) @map("last_active_at")
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 3.2 API エンドポイント（新規実装）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/users/:userId/sessions` | セッション一覧取得 |
| DELETE | `/api/users/:userId/sessions/:sessionId` | 特定セッション無効化 |
| DELETE | `/api/users/:userId/sessions` | 全セッション無効化（現在を除く） |

#### リクエスト/レスポンス

```typescript
// GET /api/users/:userId/sessions
// Response
{
  "data": [
    {
      "id": "session-uuid",
      "userAgent": "Mozilla/5.0 ...",
      "ipAddress": "192.168.1.1",
      "lastActiveAt": "2025-01-01T12:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z",
      "isCurrent": true  // 現在のセッションかどうか
    }
  ]
}

// DELETE /api/users/:userId/sessions/:sessionId
// Response
{
  "data": { "success": true }
}

// DELETE /api/users/:userId/sessions
// Response
{
  "data": { "revokedCount": 3 }
}
```

### 3.3 バックエンド実装

#### 対象ファイル（新規作成）
- `apps/api/src/controllers/session.controller.ts`
- `apps/api/src/services/session.service.ts`
- `apps/api/src/repositories/session.repository.ts`
- `apps/api/src/routes/session.ts`

#### 実装内容

```typescript
// session.controller.ts
export class SessionController {
  // セッション一覧取得
  async getSessions(req: Request, res: Response): Promise<void>

  // 特定セッション無効化
  async revokeSession(req: Request, res: Response): Promise<void>

  // 全セッション無効化（現在を除く）
  async revokeAllSessions(req: Request, res: Response): Promise<void>
}

// session.service.ts
export class SessionService {
  // アクティブセッション一覧取得（期限切れ・無効化済みを除く）
  async getActiveSessions(userId: string): Promise<Session[]>

  // セッション無効化
  async revokeSession(sessionId: string, userId: string): Promise<void>

  // 全セッション無効化（指定セッションを除く）
  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number>
}

// session.repository.ts
export class SessionRepository {
  async findActiveByUserId(userId: string): Promise<Session[]>
  async revoke(sessionId: string): Promise<void>
  async revokeAllByUserId(userId: string, exceptId?: string): Promise<number>
}
```

### 3.4 フロントエンド実装

#### 対象ファイル
- `apps/web/src/pages/Settings.tsx` (SecuritySettings セクション)

#### 実装内容
1. セッション一覧表示コンポーネント
2. 各セッションの情報表示（デバイス、IP、最終アクティブ日時）
3. 現在のセッションのハイライト表示
4. 個別セッションの「ログアウト」ボタン
5. 「他のすべてのセッションをログアウト」ボタン
6. 確認ダイアログ

---

## 4. 実装手順

### Step 1: セッション管理 API（バックエンド）
1. `session.repository.ts` 作成
2. `session.service.ts` 作成
3. `session.controller.ts` 作成
4. `session.ts` ルート作成
5. ユニットテスト作成

### Step 2: プロフィール更新（フロントエンド）
1. API クライアントに `updateUser` メソッド追加
2. `Settings.tsx` の保存処理実装
3. トースト通知実装
4. E2E テスト作成

### Step 3: セッション管理 UI（フロントエンド）
1. API クライアントにセッション管理メソッド追加
2. `SecuritySettings` コンポーネント実装
3. セッション一覧表示
4. ログアウト機能実装
5. E2E テスト作成

### Step 4: OAuth 連携管理
1. Account API 実装（一覧・追加・解除）
2. フロントエンド UI 実装
3. テスト作成

---

## 5. テスト計画

### ユニットテスト
| 対象 | テスト内容 |
|------|-----------|
| SessionRepository | CRUD 操作、フィルタリング |
| SessionService | ビジネスロジック、権限チェック |
| SessionController | リクエスト/レスポンス処理 |

### 結合テスト
| 対象 | テスト内容 |
|------|-----------|
| セッション API | 一覧取得、無効化、権限チェック |
| プロフィール API | 更新、バリデーション |

### E2E テスト
| シナリオ | テスト内容 |
|---------|-----------|
| プロフィール更新 | 表示名変更、アバター変更、保存確認 |
| セッション管理 | 一覧表示、個別ログアウト、全ログアウト |

---

## 6. ファイル構成

### 新規作成ファイル
```
apps/api/src/
├── controllers/
│   └── session.controller.ts
├── services/
│   └── session.service.ts
├── repositories/
│   └── session.repository.ts
└── routes/
    └── session.ts

apps/web/src/
├── lib/
│   └── api.ts (既存ファイルに追記)
└── pages/
    └── Settings.tsx (既存ファイルを修正)
```

### 修正ファイル
```
apps/api/src/
├── routes/index.ts (セッションルート追加)
└── controllers/auth.controller.ts (セッション情報追加)

apps/web/src/
└── pages/Settings.tsx (API呼び出し実装)
```

---

## 7. 見積もり作業量

| タスク | 規模 |
|--------|------|
| セッション管理 API | 中 |
| プロフィール更新 UI | 小 |
| セッション管理 UI | 中 |
| OAuth 連携管理 | 中 |
| テスト作成 | 中 |

---

## 8. 次のステップ

Phase 1 完了後、Phase 2（組織・権限管理）へ進む：
- 組織作成・設定
- メンバー招待・管理
- ロール・権限管理
