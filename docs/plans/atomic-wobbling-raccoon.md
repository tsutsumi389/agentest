# メニュー削除プラン

## 概要
リンク先のないメニューと不要なドロップダウンを削除する。

## 削除対象
1. **テスト実行メニュー** - `/executions` へのリンク（ルート未定義）
2. **レポートメニュー** - `/reports` へのリンク（ルート未定義）
3. **ワークスペースドロップダウン** - OrganizationSelector（組織切り替え機能）

## 残すもの
- **組織メニュー** (`/organizations`) - 組織一覧ページへのリンク（ルートあり）

## 修正ファイル

### `apps/web/src/components/layout-parts/SlideoverMenu.tsx`

1. **navLinksから削除** (22-27行目)
   ```tsx
   // 変更前
   const navLinks = [
     { to: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
     { to: '/projects', label: 'プロジェクト', icon: FolderKanban },
     { to: '/executions', label: 'テスト実行', icon: Play },
     { to: '/reports', label: 'レポート', icon: FileText },
   ];

   // 変更後
   const navLinks = [
     { to: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
     { to: '/projects', label: 'プロジェクト', icon: FolderKanban },
   ];
   ```

2. **ワークスペースセクション削除** (90-96行目)
   ```tsx
   // 削除するブロック
   <div>
     <p className="px-3 py-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
       ワークスペース
     </p>
     <OrganizationSelector onClose={onClose} />
   </div>
   ```

3. **未使用importの削除** (1-12行目)
   - `Play` - テスト実行アイコン
   - `FileText` - レポートアイコン
   - `OrganizationSelector` - 組織セレクターコンポーネント

## 検証方法
1. `docker compose exec dev pnpm build` でビルドエラーがないことを確認
2. ブラウザでメニューを開き、以下を確認:
   - 「テスト実行」と「レポート」が表示されないこと
   - 「ワークスペース」セクションが表示されないこと
   - 「組織」メニューが表示されること
   - 「ダッシュボード」「プロジェクト」が正常に動作すること
