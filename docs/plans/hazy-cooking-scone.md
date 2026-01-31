# Admin ヘッダーコンポーネント化 & ハンバーガーメニュー実装

## 概要

Adminアプリケーションのヘッダーをコンポーネント化し、web側と同様のハンバーガーメニューを実装する。

## 現状の問題

1. **重複コード**: `UserDetail.tsx`と`OrganizationDetail.tsx`にインラインでヘッダーが実装されている
2. **ハンバーガーメニュー未実装**: ナビゲーションがヘッダー内に直接配置されモバイル対応が不十分

## 実装方針

Web側の`Layout.tsx` + `SlideoverMenu.tsx`パターンを採用し、`AdminLayout`でメニュー開閉状態を管理する。

## 変更ファイル一覧

### 新規作成
| ファイル | 説明 |
|---------|------|
| `apps/admin/src/components/layout/AdminLayout.tsx` | レイアウト全体（状態管理） |
| `apps/admin/src/components/layout/AdminSlideoverMenu.tsx` | スライドオーバーメニュー |
| `apps/admin/src/components/layout/index.ts` | エクスポート |

### 修正
| ファイル | 変更内容 |
|---------|---------|
| `apps/admin/src/styles/globals.css` | アニメーションCSS追加 |
| `apps/admin/tailwind.config.ts` | z-index設定追加 |
| `apps/admin/src/components/layout/AdminHeader.tsx` | `onMenuClick` props追加、ハンバーガーボタン追加、ヘッダー固定化 |
| `apps/admin/src/App.tsx` | ルーティングをAdminLayout使用に変更 |
| `apps/admin/src/pages/Dashboard.tsx` | AdminHeaderとラッパー削除 |
| `apps/admin/src/pages/Users.tsx` | AdminHeaderとラッパー削除 |
| `apps/admin/src/pages/Organizations.tsx` | AdminHeaderとラッパー削除 |
| `apps/admin/src/pages/UserDetail.tsx` | インラインヘッダー削除 |
| `apps/admin/src/pages/OrganizationDetail.tsx` | インラインヘッダー削除 |

## 実装手順

### Phase 1: CSS/Tailwind設定

**globals.css** に追加:
```css
@layer utilities {
  .animate-slide-in-left {
    animation: slide-in-left 0.2s ease-out;
  }
  @keyframes slide-in-left {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.15s ease-out;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

**tailwind.config.ts** に追加:
```typescript
zIndex: {
  overlay: '50',
  modal: '60',
  header: '40',
}
```

### Phase 2: AdminSlideoverMenu作成

- web側の`SlideoverMenu.tsx`を参考に作成
- メニュー項目: ダッシュボード(`/`)、ユーザー(`/users`)、組織(`/organizations`)
- ESCキー・オーバーレイクリックで閉じる
- アニメーション適用

### Phase 3: AdminHeader修正

- `onMenuClick: () => void` propsを追加
- ハンバーガーボタン（Menuアイコン）を左側に追加
- ヘッダーを固定（`fixed top-0 left-0 right-0 z-header`）
- デスクトップ（md以上）ではナビゲーションリンクも表示

### Phase 4: AdminLayout作成

```typescript
export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onMenuClick={() => setMenuOpen(true)} />
      <AdminSlideoverMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="pt-16"><Outlet /></main>
    </div>
  );
}
```

### Phase 5: App.tsx修正

```typescript
<Route element={<AuthGuard><AdminLayout /></AuthGuard>}>
  <Route path="/" element={<Dashboard />} />
  <Route path="/users" element={<Users />} />
  <Route path="/users/:id" element={<UserDetail />} />
  <Route path="/organizations" element={<Organizations />} />
  <Route path="/organizations/:id" element={<OrganizationDetail />} />
</Route>
```

### Phase 6: 各ページ修正

各ページから以下を削除:
- `<AdminHeader />` インポートと使用
- `<div className="min-h-screen bg-background">` ラッパー
- インラインヘッダー（詳細ページ）
- ログアウト関連のコード（詳細ページ）

## 検証方法

1. `docker compose exec dev pnpm build` でビルド確認
2. ブラウザで http://localhost:5174 にアクセス
3. 以下を確認:
   - ハンバーガーメニューが表示される
   - クリックでスライドオーバーメニューが開く
   - メニュー項目クリックで画面遷移
   - ESCキー・オーバーレイクリックでメニューが閉じる
   - 全ページでヘッダーが統一されている
