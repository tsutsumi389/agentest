# 管理者ログアウト機能追加

## 概要
ダッシュボードのヘッダーにログアウトボタンを追加する。
バックエンドAPI、フロントエンドストア/APIは既に実装済みのため、UIのみ追加。

## 現状
- **バックエンド**: `POST /admin/auth/logout` 実装済み
- **フロントエンドストア**: `logout()` アクション実装済み
- **UI**: ログアウトボタン**なし** ← ここを追加

## 実装内容

### 変更ファイル
`apps/admin/src/pages/Dashboard.tsx`

### 実装詳細
1. `useAdminAuth` フックをインポート
2. `logout` 関数と `admin` 情報を取得
3. ヘッダー右側にログアウトボタンを追加（LogOutアイコン使用）
4. ボタンクリック時に `logout()` を呼び出し

### ヘッダーの変更箇所
```diff
  <div className="flex items-center gap-4">
+   <span className="text-sm text-foreground-muted">
+     {admin?.name}
+   </span>
    <div className="w-8 h-8 rounded-full bg-accent-muted ...">
      <span className="text-sm font-medium text-accent">A</span>
    </div>
+   <button
+     onClick={handleLogout}
+     className="btn btn-ghost p-2"
+     title="ログアウト"
+   >
+     <LogOut className="w-5 h-5" />
+   </button>
  </div>
```

### ログアウト処理
```typescript
const { admin, logout } = useAdminAuth();
const navigate = useNavigate();

const handleLogout = async () => {
  await logout();
  navigate('/login');
};
```

## 検証方法
1. `docker compose up` でサーバー起動
2. `/admin/login` でログイン
3. ダッシュボードのヘッダー右側にログアウトボタンが表示されることを確認
4. ボタンをクリックしてログアウト → `/login` にリダイレクトされることを確認
5. ログアウト後、ダッシュボードに直接アクセスしても `/login` にリダイレクトされることを確認
