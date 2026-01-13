# 提出済みレビューの評価（verdict）変更機能

## 概要
提出済み（SUBMITTED状態）のレビューについて、投稿者本人が評価（verdict）のみを変更できる機能を実装する。

## 要件
- 投稿者本人のみが評価変更可能
- 評価（verdict: APPROVED/CHANGES_REQUESTED/COMMENT_ONLY）のみ変更可能、サマリーは編集不可
- 「レビューを提出」モーダルと同様のUIで評価を変更

## 実装計画

### Phase 1: バックエンド

#### 1.1 バリデーションスキーマの追加
**ファイル**: `packages/shared/src/validators/schemas.ts`
- `reviewVerdictUpdateSchema` を追加（verdict のみ）

#### 1.2 ReviewRepositoryに新メソッド追加
**ファイル**: `apps/api/src/repositories/review.repository.ts`
- `updateVerdict(id: string, verdict: ReviewVerdict)` メソッド追加

#### 1.3 ReviewServiceに新メソッド追加
**ファイル**: `apps/api/src/services/review.service.ts`
- `updateVerdict(reviewId, userId, data)` メソッド追加
- 投稿者本人チェック
- SUBMITTED状態チェック

#### 1.4 ReviewControllerに新エンドポイント追加
**ファイル**: `apps/api/src/controllers/review.controller.ts`
- `updateVerdict` メソッド追加

#### 1.5 ルート追加
**ファイル**: `apps/api/src/routes/reviews.ts`
- `PATCH /:reviewId/verdict` ルート追加

### Phase 2: フロントエンド

#### 2.1 APIクライアントの追加
**ファイル**: `apps/web/src/lib/api.ts`
- `reviewsApi.updateVerdict(reviewId, verdict)` メソッド追加

#### 2.2 VERDICT_OPTIONSの共通化
**ファイル**: `apps/web/src/lib/constants.ts`
- `ReviewSubmitModal.tsx` 内の `VERDICT_OPTIONS` を共通モジュールに移動

#### 2.3 評価変更モーダルコンポーネント作成
**ファイル**: `apps/web/src/components/review/ReviewVerdictEditModal.tsx` (新規作成)
- `ReviewSubmitModal` をベースに評価変更専用モーダルを作成
- サマリー入力欄なし
- 現在の評価を初期選択状態に

#### 2.4 ReviewDetailContentに編集ボタン追加
**ファイル**: `apps/web/src/components/review/ReviewDetailContent.tsx`
- `currentUserId` props追加
- 投稿者本人の場合、評価バッジ横に「変更」ボタン表示
- ボタンクリックで `ReviewVerdictEditModal` を開く

#### 2.5 ReviewPanelからcurrentUserIdを渡す
**ファイル**: `apps/web/src/components/review/ReviewPanel.tsx`
- `ReviewDetailContent` に `currentUserId` を渡す

## 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/validators/schemas.ts` | reviewVerdictUpdateSchema追加 |
| `apps/api/src/repositories/review.repository.ts` | updateVerdictメソッド追加 |
| `apps/api/src/services/review.service.ts` | updateVerdictメソッド追加 |
| `apps/api/src/controllers/review.controller.ts` | updateVerdictメソッド追加 |
| `apps/api/src/routes/reviews.ts` | PATCH /:reviewId/verdict ルート追加 |
| `apps/web/src/lib/api.ts` | reviewsApi.updateVerdict追加 |
| `apps/web/src/lib/constants.ts` | VERDICT_OPTIONS追加 |
| `apps/web/src/components/review/ReviewSubmitModal.tsx` | VERDICT_OPTIONS を constants.ts からインポート |
| `apps/web/src/components/review/ReviewVerdictEditModal.tsx` | 新規作成 |
| `apps/web/src/components/review/ReviewDetailContent.tsx` | 編集ボタンとモーダル連携追加 |
| `apps/web/src/components/review/ReviewPanel.tsx` | currentUserIdをReviewDetailContentに渡す |

## 検証方法

1. **開発サーバー起動**
   ```bash
   cd docker && docker compose up
   ```

2. **機能テスト**
   - テストスイートのレビュータブを開く
   - 新規レビューを作成して提出
   - 提出済みレビューの詳細画面で「変更」ボタンが表示されることを確認
   - 評価を変更して保存できることを確認
   - 他のユーザーとしてログインした場合、「変更」ボタンが表示されないことを確認

3. **エッジケース確認**
   - 投稿者以外のユーザーがAPIを直接叩いた場合に403エラーになることを確認
   - DRAFT状態のレビューに対してverdict変更APIを叩いた場合に400エラーになることを確認
