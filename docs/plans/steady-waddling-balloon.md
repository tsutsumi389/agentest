# ドキュメント更新: OAuthプロバイダー機能トグル

## Context

`docs/plans/purrfect-sniffing-biscuit.md` の実装が完了し、OAuthプロバイダーを環境変数で有効/無効に制御する機能が追加された。以下の実装変更に対応するドキュメント更新を行う。

**実装済みの変更:**
- `GET /api/config` 公開設定API（認証不要）を新設
- フロントエンドで `useConfigStore` による設定キャッシュ
- Login/Register/Settings ページでOAuthボタンの条件表示
- `.env.example` のOAuthコメント改善

---

## 変更対象ファイル

### 1. `docs/api/README.md` — 公開設定APIエンドポイント追加

「認証」セクションの前に「公開設定」セクションを追加:

```markdown
### 公開設定

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/config` | アプリケーション公開設定取得（認証不要） |
```

**注意:** このエンドポイントは `/api/v1` ベースURLではなく `/api/config` に直接マウントされている。

### 2. `docs/architecture/features/authentication.md`

#### a. 機能一覧テーブルに追加（AUTH-024）

```
| AUTH-024 | OAuthプロバイダー機能トグル | 環境変数でOAuthプロバイダーの有効/無効を制御、UIに自動反映 | 実装済 |
```

#### b. ログイン画面の表示要素を更新（38〜48行目付近）

OAuthボタンの条件表示について記載を追加:
- 区切り線、GitHubボタン、Googleボタンの表示条件を明記
- 「OAuthプロバイダーが1つも有効でない場合、OAuth関連のUI（区切り線・ボタン）は非表示」

#### c. 新規登録画面の表示要素を更新（79〜91行目付近）

同様にOAuth条件表示の記載を追加。

#### d. 「OAuth連携」ビジネスルールセクション（562〜567行目付近）に追記

```markdown
- OAuthプロバイダーの有効/無効は環境変数で制御（`GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` が両方設定されている場合に有効）
- `GET /api/config` で利用可能なプロバイダー情報を公開（認証不要）
- 無効なプロバイダーはLogin/Register/Settingsの全画面でボタンが非表示
```

#### e. 設定値テーブル（578〜587行目付近）に追記

```
| GITHUB_CLIENT_ID | - | GitHub OAuth クライアントID（未設定でGitHub認証無効） |
| GITHUB_CLIENT_SECRET | - | GitHub OAuth シークレット（未設定でGitHub認証無効） |
| GOOGLE_CLIENT_ID | - | Google OAuth クライアントID（未設定でGoogle認証無効） |
| GOOGLE_CLIENT_SECRET | - | Google OAuth シークレット（未設定でGoogle認証無効） |
```

### 3. `docs/architecture/overview.md` — 環境変数テーブル更新（197〜217行目付近）

`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` の行を更新:
- 「GitHub OAuth クライアント ID」→「GitHub OAuth クライアント ID（未設定でGitHub認証無効、UIからボタン非表示）」
- Google も同様に更新

### 4. `docs/operations/secrets-management.md` — `.env.example` セクション更新

セクション3.1の `.env.example` ブロック内のOAuth部分を実際の `.env.example` の内容に合わせて更新:

```bash
# OAuth - GitHub（未設定の場合、GitHub認証は無効になりUIからもボタンが非表示になります）
# GITHUB_CLIENT_ID=your-github-client-id
# GITHUB_CLIENT_SECRET=your-github-client-secret
# GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback

# OAuth - Google（未設定の場合、Google認証は無効になりUIからもボタンが非表示になります）
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
# GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

### 5. `docs/api/auth.md` — OAuth認証セクションに注記追加

「OAuth 認証」セクション（33〜41行目付近）の直後に注記を追加:

```markdown
> **Note:** OAuthプロバイダーは環境変数（`GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` 等）が設定されている場合のみ有効になります。未設定のプロバイダーのエンドポイントは登録されず、404を返します。利用可能なプロバイダーは `GET /api/config` で確認できます。
```

---

## 検証

1. ドキュメント内容が実装コード（`apps/api/src/routes/config.ts`、`apps/web/src/stores/config.ts`）と一致していることを確認
2. 内部リンクが壊れていないことを確認
3. `pnpm build` に影響なし（ドキュメントのみの変更）
