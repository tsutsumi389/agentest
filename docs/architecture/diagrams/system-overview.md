# システム構成図（詳細）

## 全体構成

```mermaid
graph TB
    subgraph Clients
        Web[Web App<br/>React 19]
        Admin[Admin App<br/>React 19]
        MCP[MCP Client<br/>Claude]
    end

    subgraph API Layer
        API[REST API<br/>Express 5]
        WS[WebSocket<br/>ws]
        MCPServer[MCP Server]
    end

    subgraph Shared Packages
        Auth[auth]
        DB[db]
        Shared[shared]
        Storage[storage]
    end

    subgraph Infrastructure
        PG[(PostgreSQL)]
        Redis[(Redis)]
        MinIO[(MinIO)]
    end

    Web --> API
    Web --> WS
    Admin --> API
    MCP --> MCPServer

    API --> Auth
    API --> DB
    API --> Shared
    API --> Storage

    WS --> Auth
    WS --> Redis

    MCPServer --> Auth
    MCPServer --> DB
    MCPServer --> Shared

    DB --> PG
    Auth --> Redis
    Storage --> MinIO
```

## 認証フロー

```mermaid
sequenceDiagram
    participant User
    participant Web
    participant API
    participant GitHub
    participant Redis

    User->>Web: ログインボタンクリック
    Web->>API: GET /auth/github
    API->>GitHub: OAuth 認可リクエスト
    GitHub->>User: 認可画面
    User->>GitHub: 許可
    GitHub->>API: コールバック（code）
    API->>GitHub: アクセストークン取得
    GitHub->>API: ユーザー情報
    API->>API: JWT 生成
    API->>Redis: リフレッシュトークン保存
    API->>Web: Set-Cookie (HttpOnly, Secure, SameSite=Strict)
    Web->>User: ダッシュボード表示
```

> **Note**: トークンは HttpOnly Cookie で管理されるため、JavaScript からアクセス不可。XSS 耐性を確保。

## リアルタイム更新フロー

```mermaid
sequenceDiagram
    participant UserA
    participant WebA
    participant API
    participant Redis
    participant WS
    participant WebB
    participant UserB

    UserA->>WebA: テストケース更新
    WebA->>API: PUT /api/v1/test-cases/:id
    API->>API: DB 更新
    API->>Redis: PUBLISH test-case:updated
    Redis->>WS: メッセージ受信
    WS->>WebB: WebSocket 通知
    WebB->>UserB: UI 更新
```

## デプロイ構成

```mermaid
graph LR
    subgraph Production
        LB[Load Balancer]
        API1[API Pod 1]
        API2[API Pod 2]
        WS1[WS Pod 1]
        WS2[WS Pod 2]
        Web[Web CDN]
    end

    subgraph Managed Services
        PG[(Cloud SQL)]
        Redis[(Memorystore)]
        Storage[(Cloud Storage)]
    end

    LB --> API1
    LB --> API2
    LB --> WS1
    LB --> WS2

    API1 --> PG
    API2 --> PG
    WS1 --> Redis
    WS2 --> Redis
```

## 関連ドキュメント

- [システム全体像](../overview.md)
- [データベース設計](../database.md)
