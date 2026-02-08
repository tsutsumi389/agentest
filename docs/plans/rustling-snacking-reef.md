# Agentest GCP 本番運用構成設計

## 概要

GCPを使用したコスト効率の良い本番運用構成。Cloud Runをメインに採用し、アイドル時のコストを最小化。

## 推奨構成図

```
                              Internet
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Cloud Armor (WAF/DDoS) │
                    └─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Global HTTP(S) LB      │
                    └─────────────────────────┘
                                  │
      ┌──────────────┬────────────┼────────────┬──────────────┐
      │              │            │            │              │
      ▼              ▼            ▼            ▼              ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ Cloud CDN │ │ Cloud CDN │ │ Cloud Run │ │ Cloud Run │ │ Cloud Run │
│ + Storage │ │ + Storage │ │ (API)     │ │ (WS)      │ │ (MCP)     │
│ (Web SPA) │ │(Admin SPA)│ │ min:0     │ │ min:1     │ │ min:0     │
│           │ │ + IAP     │ │ max:10    │ │ max:5     │ │ max:2     │
└───────────┘ └───────────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                                  │              │              │
                                  ▼              ▼              ▼
                    ┌─────────────────────────────────────────────┐
                    │              VPC ネットワーク               │
                    │                                             │
                    │  ┌─────────────┐  ┌─────────────┐          │
                    │  │ Cloud Run   │  │ Cloud        │          │
                    │  │ Jobs        │  │ Scheduler    │          │
                    │  │ (Batch)     │  │ (Cron)       │          │
                    │  └──────┬──────┘  └──────────────┘          │
                    │         │                                   │
                    │  ┌──────┴──────────────────────────────┐    │
                    │  │              │              │        │    │
                    │  ▼              ▼              ▼        │    │
                    │ ┌───────────┐ ┌───────────┐ ┌────────┐ │    │
                    │ │ Cloud SQL │ │Memorystore│ │ Cloud  │ │    │
                    │ │(PostgreSQL│ │ (Redis 7) │ │Storage │ │    │
                    │ │ 16)       │ │ 5GB Basic │ │(Files) │ │    │
                    │ │2vCPU/8GB  │ │           │ │Standard│ │    │
                    │ └───────────┘ └───────────┘ └────────┘ │    │
                    │                                         │    │
                    │  ┌───────────┐  ┌───────────┐           │    │
                    │  │ Secret    │  │ SendGrid  │           │    │
                    │  │ Manager   │  │ (Mail)    │           │    │
                    │  └───────────┘  └───────────┘           │    │
                    └─────────────────────────────────────────────┘
```

## 現在のサービス構成との対応

| アプリ (apps/) | Dockerfile | GCPサービス | 備考 |
|---------------|-----------|------------|------|
| web | `Dockerfile.web` (nginx) | Cloud Storage + CDN | ビルド成果物を静的配信 |
| admin | `Dockerfile.admin` (nginx) | Cloud Storage + CDN + IAP | IP制限/IAP でアクセス制御 |
| api | `Dockerfile.api` | Cloud Run (service) | REST API |
| ws | `Dockerfile.ws` | Cloud Run (service) | WebSocket、常時起動 |
| mcp-server | `Dockerfile.mcp` | Cloud Run (service) | MCP Protocol、オンデマンド |
| jobs | ※新規作成 | Cloud Run Jobs | Cloud Scheduler で定期実行 |

| パッケージ (packages/) | GCPでの対応 |
|-----------------------|-------------|
| db | Cloud SQL (PostgreSQL 16) |
| storage | Cloud Storage（S3互換APIで接続、SDK変更不要） |
| auth | Secret Manager で鍵管理 |
| shared | アプリにバンドル |
| ui | Web/Admin にバンドル |
| ws-types | WS/APIにバンドル |

## コンポーネント選定

| コンポーネント | GCPサービス | 選定理由 |
|---------------|------------|---------|
| API/WS/MCP | Cloud Run (service) | ゼロスケール対応、100ms単位課金、運用負荷最小 |
| Batch (jobs) | Cloud Run Jobs | ジョブ単位課金、Cloud Schedulerで定期実行 |
| Frontend (web) | Cloud Storage + CDN | 静的配信、グローバルキャッシュ |
| Frontend (admin) | Cloud Storage + CDN + IAP | 静的配信 + Identity-Aware Proxy でアクセス制限 |
| Database | Cloud SQL (PostgreSQL 16) | マネージド、自動バックアップ、HA対応 |
| Cache/PubSub | Memorystore (Redis 7) | VPCネイティブ、低遅延、WebSocket Pub/Sub |
| File Storage | Cloud Storage | S3互換API（`packages/storage` がそのまま利用可能） |
| Mail | SendGrid | 開発: Mailpit → 本番: SendGrid API |
| WAF | Cloud Armor | DDoS保護、OWASP Top 10対策 |
| Secrets | Secret Manager | 環境変数・APIキーの安全な管理 |
| Scheduler | Cloud Scheduler | jobs の定期実行トリガー |

## Cloud Run 構成詳細

### Cloud Run Services

| サービス | Dockerfile | min | max | CPU | Memory | CPU allocation |
|---------|-----------|-----|-----|-----|--------|----------------|
| API Server | `Dockerfile.api` | 0 | 10 | 1 | 512MB | Request時のみ |
| WebSocket | `Dockerfile.ws` | 1 | 5 | 0.5 | 512MB | 常時確保（必須） |
| MCP Server | `Dockerfile.mcp` | 0 | 2 | 0.5 | 512MB | Request時のみ |

### Cloud Run Jobs

| ジョブ | トリガー | CPU | Memory | タイムアウト |
|--------|---------|-----|--------|-------------|
| Batch Jobs | Cloud Scheduler (cron) | 1 | 512MB | 600s |

### Static Hosting (Cloud Storage + CDN)

| サイト | Dockerfile (ビルド参照) | CDN | アクセス制限 |
|--------|----------------------|-----|-------------|
| Web SPA | `Dockerfile.web` | Cloud CDN | なし（公開） |
| Admin SPA | `Dockerfile.admin` | Cloud CDN | IAP + IP制限 |

※ Dockerfile はビルドステージのみ流用し、成果物を Cloud Storage にアップロード

---

## コスト見積もり

### 初期構成（月額）- 100ユーザー想定

| サービス | 構成 | USD | JPY |
|---------|------|-----|-----|
| Cloud Run - API | 0.5 CPU, 512MB, 平均2インスタンス | $25 | ¥3,750 |
| Cloud Run - WS | 0.5 CPU, 512MB, 常時1インスタンス | $30 | ¥4,500 |
| Cloud Run - MCP | 0.5 CPU, 512MB, オンデマンド | $5 | ¥750 |
| Cloud Run Jobs | 1日数回実行、実行時間数分 | $3 | ¥450 |
| Cloud SQL | db-custom-2-8192, 50GB, Single | $120 | ¥18,000 |
| Memorystore | Basic 5GB | $55 | ¥8,250 |
| Cloud Storage | 50GB Standard（ファイル + SPA） | $3 | ¥450 |
| Load Balancer | Global HTTP(S) LB | $25 | ¥3,750 |
| Cloud CDN | 100GB egress（Web + Admin） | $8 | ¥1,200 |
| Cloud Armor | Standard Policy | $8 | ¥1,200 |
| SendGrid | Free tier（100通/日） | $0 | ¥0 |
| その他 | Secret Manager, Logging, IAP, Scheduler, VPC等 | $25 | ¥3,750 |
| **合計** | | **$307** | **約¥46,000** |

### SLA別追加コスト

| プラン | 追加構成 | 追加コスト/月 |
|--------|---------|--------------|
| Team (99.9%) | Cloud SQL HA | +¥18,000 |
| Enterprise (99.95%) | Cloud SQL HA + Memorystore Standard | +¥26,000 |

### 成長期構成（月額）- 1,000ユーザー想定

| サービス | 構成 | USD | JPY |
|---------|------|-----|-----|
| Cloud Run - API | 1 CPU, 1GB, 平均5インスタンス | $150 | ¥22,500 |
| Cloud Run - WS | 1 CPU, 1GB, 常時3インスタンス | $180 | ¥27,000 |
| Cloud Run - MCP | 1 CPU, 1GB, オンデマンド | $30 | ¥4,500 |
| Cloud Run Jobs | 1日10回以上実行 | $10 | ¥1,500 |
| Cloud SQL | db-custom-4-16384, 100GB, HA | $400 | ¥60,000 |
| Memorystore | Standard 10GB | $180 | ¥27,000 |
| SendGrid | Essentials（40K通/月） | $20 | ¥3,000 |
| その他 | Storage, CDN, LB, IAP, Scheduler, 監視等 | $155 | ¥23,250 |
| **合計** | | **$1,125** | **約¥169,000** |

---

## 損益分岐点の試算

### 前提: プラン体系

| プラン | 対象 | 月額 |
|--------|------|------|
| FREE | 個人 | ¥0 |
| PRO | 個人 | ¥980 |
| TEAM | 組織 | ¥1,200/user |

### ユーザー構成比の想定

| パターン | FREE | PRO | TEAM |
|---------|------|-----|------|
| 保守的 | 90% | 8% | 2% |
| 標準 | 85% | 10% | 5% |
| 楽観的 | 80% | 12% | 8% |

### 損益分岐ユーザー数

#### 初期構成（¥46,000/月）

| パターン | 総ユーザー数 | うち有料 | 月間売上 |
|---------|------------|---------|---------|
| 保守的 | **約480人** | 48人 | ¥49,100 |
| 標準 | **約295人** | 44人 | ¥46,600 |
| 楽観的 | **約195人** | 39人 | ¥46,300 |

#### 成長期構成（¥169,000/月）

| パターン | 総ユーザー数 | うち有料 | 月間売上 |
|---------|------------|---------|---------|
| 保守的 | **約1,770人** | 177人 | ¥181,200 |
| 標準 | **約1,090人** | 164人 | ¥172,700 |
| 楽観的 | **約710人** | 142人 | ¥168,900 |

### ユーザー数別収益シミュレーション（標準パターン）

| 総ユーザー | 有料転換率 | 月間売上 | インフラ費 | 損益 |
|-----------|-----------|---------|-----------|------|
| 100人 | 15% | ¥17,000 | ¥46,000 | ▲¥29,000 |
| 300人 | 15% | ¥51,000 | ¥46,000 | **+¥5,000** |
| 500人 | 15% | ¥85,000 | ¥46,000 | **+¥39,000** |
| 1,000人 | 15% | ¥170,000 | ¥169,000 | **+¥1,000** |
| 2,000人 | 15% | ¥340,000 | ¥169,000 | **+¥171,000** |

### 結論

| フェーズ | インフラコスト | 損益分岐点（標準） |
|---------|--------------|------------------|
| 初期 | ¥46,000/月 | **約295人**（有料44人） |
| 成長期 | ¥169,000/月 | **約1,090人**（有料164人） |

※ GCP新規アカウントは$300の無料クレジット（90日間）あり

---

## コスト削減Tips

### 即効性の高い施策

| 施策 | 削減効果 | 難易度 |
|------|---------|--------|
| min-instances=0（API/MCP） | 20-40% | 低 |
| CUD 1年契約（Cloud SQL） | 17% | 低 |
| CUD 1年契約（Memorystore） | 20% | 低 |
| ストレージライフサイクル（30日→Nearline→Archive） | 30-50% | 低 |
| CDNキャッシュ最適化 | 10-20% | 中 |

### 運用時の注意

1. **Cloud Run**: WebSocket以外は `min=0` でゼロスケール活用
2. **Cloud SQL**: 開発環境は夜間停止（activation-policy=NEVER）
3. **ログ**: DEBUGログは本番で無効化、古いログはStorageへエクスポート
4. **ネットワーク**: 全サービスを asia-northeast1 に集約（リージョン内通信無料）

---

## 実装時の変更点

### アプリケーション変更

| 対象 | 変更内容 | 対応状況 |
|------|---------|---------|
| 環境変数 | Secret Manager 参照に変更 | 未対応 |
| ストレージ | `packages/storage` は S3互換API を使用しているため Cloud Storage の S3互換エンドポイントに接続先を変更するだけで動作 | 変更最小限 |
| ヘルスチェック | API/WS/MCP に `/health` エンドポイント確認 | 確認済み |
| シャットダウン | SIGTERM ハンドリングの実装 | 確認必要 |
| メール | Mailpit → SendGrid API に差し替え | 未対応 |

### Dockerfileの対応状況

| ファイル | 状況 | Cloud Run対応メモ |
|---------|------|------------------|
| `docker/Dockerfile.api` | 実装済み | ヘルスチェック付き、非rootユーザー |
| `docker/Dockerfile.ws` | 実装済み | ヘルスチェック付き、非rootユーザー |
| `docker/Dockerfile.mcp` | 実装済み | UI埋め込みビルド、ヘルスチェック付き |
| `docker/Dockerfile.web` | 実装済み | nginx、SPA用（CDN配信時はビルドステージのみ利用） |
| `docker/Dockerfile.admin` | 実装済み | nginx、SPA用（CDN配信時はビルドステージのみ利用） |
| `docker/Dockerfile.jobs` | **未作成** | `Dockerfile.api` を参考に作成 |

### WebSocket 固有

- Load Balancer: Session Affinity設定
- Cloud Run: タイムアウト延長（最大3600秒）
- 最小インスタンス: `min=1` 必須（コールドスタート防止）
- Redis Pub/Sub によるマルチインスタンス同期は `packages/ws-types` で型定義済み

### Cloud Run Jobs (apps/jobs) 固有

- Cloud Scheduler で cron トリガー
- Stripe webhook 処理などのバッチを実行
- `Dockerfile.jobs` を新規作成（`Dockerfile.api` ベース、CMD のみ変更）

---

## 実装マイルストーン

| フェーズ | 期間 | 内容 |
|---------|------|------|
| Phase 1 | 2週間 | Terraform基盤、Cloud SQL/Memorystore構築、VPC設定 |
| Phase 2 | 2週間 | Cloud Run移行（API/WS/MCP）、Dockerfile.jobs作成、CI/CD構築 |
| Phase 3 | 1週間 | Load Balancer/CDN、SSL設定、Web/Admin SPA配信設定 |
| Phase 4 | 1週間 | IAP（Admin SPA）、Cloud Armor、SendGrid設定 |
| Phase 5 | 1週間 | 監視・アラート、Cloud Scheduler（Jobs）、Secret Manager移行 |
| Phase 6 | 1週間 | 負荷テスト、DR訓練 |
| Phase 7 | 1週間 | 本番切替、監視強化 |

---

## 検証方法

1. **Terraform plan**: インフラ構成の事前確認
2. **負荷テスト**: k6/Locustで想定トラフィックをシミュレーション
3. **フェイルオーバーテスト**: Cloud SQL HA切り替え確認
4. **コスト監視**: Budget AlertでCloud Run/SQL/Memorystoreの使用量監視
5. **E2E テスト**: Playwright でデプロイ後の動作確認（`pnpm test:e2e`）

---

## 参考: 重要ファイル

### インフラ・構成

- `docker/docker-compose.yml` - 現在のサービス構成
- `docker/docker-compose.override.yml` - 開発環境オーバーライド
- `docker/Dockerfile.api` - API サーバー本番ビルド
- `docker/Dockerfile.ws` - WebSocket サーバー本番ビルド
- `docker/Dockerfile.mcp` - MCP サーバー本番ビルド
- `docker/Dockerfile.web` - Web SPA 本番ビルド (nginx)
- `docker/Dockerfile.admin` - Admin SPA 本番ビルド (nginx)
- `infrastructure/terraform/` - Terraform 構成（未作成）

### アーキテクチャ・要件

- `docs/architecture/overview.md` - システムアーキテクチャ
- `docs/operations/sla.md` - SLA要件
- `packages/db/prisma/schema.prisma` - DBスキーマ（60+テーブル）
- `.env.example` - 環境変数定義
