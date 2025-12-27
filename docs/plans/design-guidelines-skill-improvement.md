# Design Guidelines スキル改善計画

## 概要

Agent Skills ベストプラクティス（https://platform.claude.com/docs/ja/agents-and-tools/agent-skills/best-practices）に基づき、`design-guidelines` スキルの改善点を特定し、修正計画を策定する。

## 現状分析

### 良好な点 ✅

| 項目 | 現状 | 評価 |
|------|------|------|
| 名前形式 | `design-guidelines`（小文字、ハイフン区切り） | ✅ 適合 |
| 説明の視点 | 三人称で記述 | ✅ 適合 |
| SKILL.md行数 | 253行（500行制限以下） | ✅ 適合 |
| 段階的開示 | Quick Referenceテーブルで参照ファイルへリンク | ✅ 適合 |
| 参照深度 | 1レベル（SKILL.md → references/） | ✅ 適合 |
| 参照ファイルのTOC | 主要ファイルにTable of Contents設置済み | ✅ 適合 |
| パス形式 | フォワードスラッシュ使用 | ✅ 適合 |
| 用語の一貫性 | 全体で統一された用語使用 | ✅ 適合 |

### 改善が必要な点 🔧

| 項目 | 現状の問題 | ベストプラクティス |
|------|-----------|-----------------|
| description | トリガーフレーズが不明確 | 「〜について言及している場合に使用」を明記 |
| ワークフロー | 明示的なステップがない | チェックリスト付きワークフローを追加 |
| コンテンツ重複 | SKILL.mdと参照ファイル間で重複 | SKILL.mdは概要のみに |
| フィードバックループ | 検証プロセスがない | デザイン実装の検証ステップを追加 |
| 具体例 | テンプレートパターンが不足 | 入出力例を追加 |

---

## 修正計画

### Phase 1: YAML Frontmatter の改善

**対象ファイル**: `.claude/skills/design-guidelines/SKILL.md`

#### 現在の description
```yaml
description: テスト管理ツールSaaSのデザインガイドライン。Terminal/CLI風のミニマルで直感的なUI/UXを実現する。UI/UXデザイン、画面設計、コンポーネント作成、スタイリング、フロントエンド実装時に使用。GitHub/Linear風の開発者向け美学を採用。
```

#### 改善後の description
```yaml
description: テスト管理ツールSaaSのUI/UXデザインガイドライン。Terminal/CLI風のミニマルなデザインシステムを提供する。UIコンポーネント、画面レイアウト、スタイリング、フロントエンド実装について言及している場合、または「デザイン」「UI」「スタイル」「コンポーネント」に関する質問がある場合に使用する。
```

**変更理由**:
- 明示的なトリガーワード（デザイン、UI、スタイル、コンポーネント）を追加
- 「〜について言及している場合に使用」形式に統一

---

### Phase 2: SKILL.md 本文の構造改善

#### 2.1 冗長なコード例の削除

**問題**: Core Visual Identity セクションのCSS変数定義が `references/colors.md` と重複

**対応**:
- SKILL.md からカラーパレットの完全な定義を削除
- 代わりにサマリーと参照リンクのみを残す

**変更前** (lines 31-51):
```markdown
### Color Philosophy

ダークモードファースト。ターミナルの美学を継承しつつ、モダンな洗練さを加える。

```css
/* Primary Palette */
--bg-primary: #0d1117;      /* GitHub Dark背景 */
...（全変数定義）
```
```

**変更後**:
```markdown
### Color Philosophy

ダークモードファースト。ターミナルの美学を継承。

| 種別 | 用途 | 詳細 |
|-----|------|------|
| Background | 背景色（Primary/Secondary/Tertiary） | [colors.md](references/colors.md#background) |
| Text | テキスト色（Primary/Secondary/Muted） | [colors.md](references/colors.md#text) |
| Accent | テスト状態（Pass/Fail/Running等） | [colors.md](references/colors.md#semantic) |
```

#### 2.2 Typography/Spacing セクションも同様に簡略化

**変更前**: 完全なCSS変数定義
**変更後**: サマリーテーブル + 参照リンク

---

### Phase 3: ワークフローセクションの追加

**追加位置**: Component Patterns セクションの後

```markdown
## Design Workflows

### 新規コンポーネント作成ワークフロー

このチェックリストをコピーして進行状況を追跡：

```
コンポーネント作成：
- [ ] ステップ1：既存コンポーネントの確認
- [ ] ステップ2：デザイントークンの選定
- [ ] ステップ3：基本構造の実装
- [ ] ステップ4：インタラクション状態の実装
- [ ] ステップ5：アクセシビリティ検証
- [ ] ステップ6：レスポンシブ対応確認
```

**ステップ1：既存コンポーネントの確認**

`references/components.md` を確認し、類似コンポーネントが存在するか確認。
存在する場合は拡張を検討。

**ステップ2：デザイントークンの選定**

`references/colors.md` と `references/typography.md` から適切なトークンを選択。
カスタム値は使用しない。

**ステップ3：基本構造の実装**

- 適切なHTML要素を選択
- CSS変数を使用してスタイリング
- `--radius-md`, `--space-*` 等のトークンを使用

**ステップ4：インタラクション状態の実装**

`references/interaction.md` を参照し、以下を実装：
- Hover状態
- Focus状態（:focus-visible）
- Active状態
- Disabled状態

**ステップ5：アクセシビリティ検証**

`references/accessibility.md` を参照し、以下を確認：
- キーボード操作可能か
- 適切なaria属性があるか
- カラーコントラストが十分か

**ステップ6：レスポンシブ対応確認**

`references/layout.md#responsive-design` を参照し、ブレークポイントごとの表示を確認。

### UI修正ワークフロー

既存UIの修正時：

1. **現状確認**: 該当コンポーネントのコードを確認
2. **ガイドライン照合**: 関連する参照ファイルを確認
3. **修正実施**: デザイントークンを使用して修正
4. **検証**: ホバー、フォーカス、レスポンシブを確認
```

---

### Phase 4: テンプレートパターンの追加

**追加位置**: Design Workflows セクションの後

```markdown
## Design Templates

### ページ構造テンプレート

```
┌─────────────────────────────────────────────────────────┐
│ Header (56px)                                           │
├────────────┬────────────────────────────────────────────┤
│  Sidebar   │ Page Header                                │
│  (240px)   │   Breadcrumb                               │
│            │   Title + Actions                          │
│            │   Tabs (optional)                          │
│            ├────────────────────────────────────────────┤
│            │ Content Body                               │
│            │   padding: var(--space-6)                  │
└────────────┴────────────────────────────────────────────┘
```

### テスト状態の色選択

| 状態 | 色 | 変数 |
|------|-----|-----|
| Passed | 緑 | `--success-*` |
| Failed | 赤 | `--error-*` |
| Running | 紫 | `#a371f7` |
| Pending | 黄 | `--warning-*` |
| Skipped | グレー | `--text-muted` |
```

---

### Phase 5: 参照ファイルの軽微な改善

#### 5.1 colors.md にアンカーリンク用IDを追加

```markdown
## Background Colors {#background}
...
## Text Colors {#text}
...
## Semantic Colors {#semantic}
```

#### 5.2 accessibility.md の拡充

現在2,421バイトと比較的小さい。以下を追加：

- WCAG 2.1 AA準拠チェックリスト
- スクリーンリーダー対応ガイド
- カラーコントラスト比の具体的な数値

---

## 変更サマリー

| Phase | ファイル | 変更内容 | 優先度 |
|-------|---------|---------|--------|
| 1 | SKILL.md | description改善 | 高 |
| 2 | SKILL.md | コード重複削除、簡略化 | 高 |
| 3 | SKILL.md | ワークフロー追加 | 高 |
| 4 | SKILL.md | テンプレートパターン追加 | 中 |
| 5 | references/*.md | アンカー追加、拡充 | 低 |

---

## 期待される効果

1. **発見性向上**: 明確なトリガーワードによりClaudeが適切にスキルを選択
2. **トークン効率**: SKILL.md簡略化により初期ロード時のトークン削減
3. **実用性向上**: ワークフローにより一貫したデザイン実装が可能
4. **段階的開示の最適化**: 必要な情報のみを参照ファイルから読み込み

---

## 実装順序

1. Phase 1（description修正）→ すぐに効果あり
2. Phase 2 + 3（構造改善 + ワークフロー）→ 同時に実施
3. Phase 4（テンプレート）→ 必要に応じて
4. Phase 5（参照ファイル）→ 運用しながら改善

---

## 備考

- 現状でもベストプラクティスの主要項目には適合している
- 修正は段階的に実施し、各段階で効果を確認することを推奨
- 修正後は実際のUI実装タスクでテストし、Claudeが適切にスキルを使用するか確認
