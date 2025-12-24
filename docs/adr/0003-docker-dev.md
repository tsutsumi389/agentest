# ADR-0003: 完全 Docker 開発の採用

## ステータス

採用

## コンテキスト

開発環境のセットアップ方法を決定する必要がある。選択肢：

1. **ホスト開発** - ホスト PC に Node.js / pnpm をインストール
2. **完全 Docker 開発** - ホストには Docker のみ、全てコンテナ内で実行
3. **ハイブリッド** - インフラは Docker、アプリはホストで実行

チームメンバーの環境：
- macOS / Windows / Linux が混在
- Node.js バージョンの不一致が過去に問題になった

## 決定

**完全 Docker 開発を採用する。**

ホスト PC に必要なもの：
- Docker Desktop（macOS / Windows）または Docker Engine（Linux）
- Docker Compose v2

ホスト PC に不要なもの：
- Node.js
- pnpm
- その他のランタイム

## 結果

### メリット

- **環境の完全な統一**
  - 全員が同じ Node.js バージョン
  - 「自分の環境では動く」問題の排除

- **セットアップの簡素化**
  - `docker compose up` だけで開始
  - README の手順が短くなる

- **本番環境との一致**
  - 開発・本番で同じ Docker イメージ
  - デプロイ時の問題を早期発見

- **クリーンなホスト環境**
  - Node.js の複数バージョン管理が不要
  - アンインストールも `docker compose down -v` で完了

### デメリット

- **パフォーマンス**
  - ファイル同期が遅い場合がある（特に macOS）
  - → バインドマウントの最適化で緩和

- **IDE 連携**
  - TypeScript の型チェックがホストで動かない
  - → VS Code Dev Containers または手動で型定義を同期

- **デバッグの複雑さ**
  - ブレークポイントの設定に追加設定が必要
  - → docker compose exec でコンテナに入って作業

### 緩和策

- macOS では Docker Desktop の VirtioFS を有効化
- VS Code Dev Containers の設定を用意
- よく使うコマンドのエイリアスをドキュメント化

### 運用コマンド

```bash
# 起動
cd docker && docker compose up --build

# pnpm コマンド実行
docker compose exec dev pnpm install
docker compose exec dev pnpm --filter @agentest/api dev

# ログ確認
docker compose logs -f api

# クリーンアップ
docker compose down -v
```
