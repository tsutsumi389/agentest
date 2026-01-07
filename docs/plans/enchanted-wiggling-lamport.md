# Agentestロゴ変更計画

## 概要
Agentestのロゴを現在の`FlaskConical`（lucide-react）から、新しい「A」ロゴに変更する。

## 現状
- **ロゴ**: lucide-reactの`FlaskConical`アイコンを使用
- **favicon**: `/vite.svg`を参照（ファイル未存在）
- **publicディレクトリ**: 未作成

## 変更対象ファイル

### 1. 新規作成
| ファイル | 説明 |
|---------|------|
| `apps/web/src/components/ui/AgentestLogo.tsx` | SVGロゴコンポーネント |
| `apps/web/public/favicon.svg` | favicon用SVGファイル |

### 2. 修正対象
| ファイル | 変更内容 |
|---------|---------|
| `apps/web/index.html` | favicon参照を`/favicon.svg`に変更 |
| `apps/web/src/components/layout-parts/Header.tsx` | FlaskConical → AgentestLogo |
| `apps/web/src/components/layout-parts/SlideoverMenu.tsx` | FlaskConical → AgentestLogo |
| `apps/web/src/pages/Login.tsx` | FlaskConical → AgentestLogo |
| `apps/web/src/pages/InvitationAccept.tsx` | FlaskConical → AgentestLogo |
| `apps/web/src/pages/OAuthConsent.tsx` | FlaskConical → AgentestLogo |

## 実装ステップ

### Step 1: publicディレクトリ作成
`apps/web/public/` ディレクトリを作成

### Step 2: AgentestLogoコンポーネント作成
`apps/web/src/components/ui/AgentestLogo.tsx`を作成
- propsでサイズ（width/height）とclassNameを受け取る
- 新しい「A」ロゴのSVGパスを実装

### Step 3: favicon.svg作成
`apps/web/public/favicon.svg`に同じロゴのSVGを配置

### Step 4: index.html修正
favicon参照を更新
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

### Step 5: 各コンポーネント修正
以下のファイルで`FlaskConical`を`AgentestLogo`に置き換え：

1. **Header.tsx** (行34-39)
   - import文変更
   - `<FlaskConical className="w-6 h-6 text-accent" />` → `<AgentestLogo className="w-6 h-6" />`

2. **SlideoverMenu.tsx** (行75-77)
   - import文変更
   - `<FlaskConical className="w-6 h-6 text-accent" />` → `<AgentestLogo className="w-6 h-6" />`

3. **Login.tsx** (行89-92)
   - import文変更
   - `<FlaskConical className="w-10 h-10 text-accent" />` → `<AgentestLogo className="w-10 h-10" />`

4. **InvitationAccept.tsx** (行17-19)
   - import文変更
   - `<FlaskConical className="w-10 h-10 text-accent" />` → `<AgentestLogo className="w-10 h-10" />`

5. **OAuthConsent.tsx**
   - import文変更
   - FlaskConical → AgentestLogo

## 注意事項
- ロゴの色は黒（#000000 or currentColor）で統一
- サイズはclassNameで制御可能にする
- 不要になった`FlaskConical`のimportは削除
