# テスト実行機能

## 概要

テストスイート単位でのテスト実行と結果記録を管理する機能を提供する。実行開始時にテストスイートとテストケースのスナップショットを作成し、実行中の変更に影響されない状態で結果を記録する。前提条件確認、ステップ実施記録、期待値判定、エビデンスファイルのアップロードをサポートする。

## 機能一覧

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| EX-001 | 実行開始 | テストスイート詳細から環境を選択して実行開始 | 実装済 |
| EX-002 | 環境選択 | プロジェクト設定の環境リストから選択 | 実装済 |
| EX-003 | スナップショット作成 | 実行開始時にテストスイート・テストケースの状態を保存 | 実装済 |
| EX-004 | 前提条件・ステップ記録 | 前提条件確認、ステップ実施の結果を記録 | 実装済 |
| EX-005 | 期待値判定 | 期待結果のPass/Fail判定を記録 | 実装済 |
| EX-006 | 実行結果一覧 | 履歴表示、フィルタリング、ページネーション | 実装済 |
| EX-007 | エビデンス管理 | ファイルアップロード、ダウンロード、削除 | 実装済 |

## 画面仕様

### 実行開始モーダル（StartExecutionModal）

- **表示タイミング**: テストスイート詳細の「実行開始」ボタンクリック時
- **表示要素**
  - テストスイート名
  - 環境選択ドロップダウン（プロジェクト設定から取得）
  - 含まれるテストケース数
  - キャンセルボタン
  - 実行開始ボタン
- **操作**
  - 実行開始ボタン → 実行作成 → 実行画面へ遷移

### 実行画面（Execution.tsx）

- **URL**: `/executions/{executionId}?testCase={testCaseId}`
- **レイアウト**: サイドバー + メインパネル構成

#### サイドバー（ExecutionSidebar）

テストケース一覧を表示し、選択状態をURLパラメータで管理する。

- **表示要素**
  - テストケース一覧
  - 各テストケースの進捗インジケーター（ドット表示）
    - 緑ドット: 全期待結果がPASS
    - 赤ドット: 1件以上がFAIL
    - 黄ドット: PASS/FAILが混在（部分的に合格）
    - グレードット: 未実行（PENDING）
  - 優先度ドット表示
  - 全体サマリーバッジ（PASS数/FAIL数/未実行数）
  - 「概要を表示」ボタン
- **操作**
  - テストケースクリックで選択（URLパラメータ連動）
  - テストケース検索（タイトル・説明からフィルタ）

#### メインパネル：概要表示（ExecutionOverviewPanel）

テストケース未選択時に表示される概要パネル。

- **表示要素（ヘッダー）**
  - テストスイートに戻るリンク
  - テストスイート名（スナップショットから）
  - ステータスバッジ（実行中/完了/中断）
  - テストスイート説明（Markdown表示）
  - 中止ボタン（実行中のみ）
  - 完了ボタン（実行中のみ）

- **メタデータカード（3列）**
  - **開始日時カード**: 実行開始日時を表示
  - **終了日時カード**: 終了日時を表示（完了時は経過時間も表示、実行中は「実行中...」）
  - **環境カード**: 実行環境名を表示（未設定時は「未設定」）

- **サマリーセクション（3段構成）**

  - **前提条件サマリー**（データがある場合のみ表示）
    - 3つのカードを横並び：
      - **満たす**: METの件数（緑色）
      - **満たさない**: NOT_METの件数（赤色）
      - **未確認**: UNCHECKEDの件数（グレー）

  - **手順サマリー**（データがある場合のみ表示）
    - 3つのカードを横並び：
      - **完了**: DONEの件数（緑色）
      - **スキップ**: SKIPPEDの件数（黄色）
      - **未実行**: PENDINGの件数（グレー）

  - **期待結果サマリー**
    - 5つのカードを横並び：
      - **成功**: PASSの件数（緑色）
      - **失敗**: FAILの件数（赤色）
      - **スキップ**: SKIPPEDの件数（黄色）
      - **実行不可**: NOT_EXECUTABLEの件数（紫色）
      - **未実行**: PENDINGの件数（グレー）

- **スイート前提条件セクション**
  - **表示条件**: テストスイートに前提条件がある場合のみ
  - **表示要素**
    - 前提条件一覧
    - 各前提条件のステータス（UNCHECKED/MET/NOT_MET）
    - ノート入力欄
  - **操作（実行中のみ）**
    - ステータスボタンをクリックして更新
    - ノートを入力して保存

#### メインパネル：テストケース詳細（ExecutionTestCaseDetailPanel）

テストケース選択時に表示される詳細パネル。

- **テストケースヘッダー**
  - テストケースタイトル
  - 優先度バッジ
  - 進捗サマリー（PASS/FAIL/未実行数）
  - PiPボタン（対応ブラウザのみ）

- **テストケース前提条件**
  - 各前提条件のステータス更新
  - ノート入力

- **ステップ一覧**
  - ステップ番号、手順内容（マークダウン対応）
  - ステータス（PENDING/DONE/SKIPPED）
  - ノート入力

- **期待結果一覧**
  - 期待結果の内容（マークダウン対応）
  - ステータス（PENDING/PASS/FAIL/SKIPPED/NOT_EXECUTABLE）
  - ノート入力
  - エビデンスアップロード領域
  - エビデンス一覧

#### エビデンス表示

- **表示要素**
  - ファイル名
  - ファイルサイズ
  - アップロード日時
  - ダウンロードボタン
  - 削除ボタン（実行中のみ）
- **アップロード**
  - ドラッグ&ドロップ対応
  - クリックしてファイル選択
  - アップロード中はローディング表示

### Picture-in-Picture機能（PipExecutionPanel）

テスト実行中に別アプリケーションを操作しながらステータスを更新できる「ながら実行」機能。

- **対応環境**: Document Picture-in-Picture API対応ブラウザ（Chrome 116以降等）
- **ウィンドウサイズ**: 450×600px
- **表示内容**
  - 現在のテストケースタイトル
  - アイテム番号（X/Y形式）
  - 前提条件・ステップ・期待結果の内容
  - ノート入力欄
  - ステータス更新ボタン（大きめのサイズで操作しやすく）
- **操作**
  - 前へ/次へボタンでアイテム切り替え
  - ステータスボタンでPASS/FAIL等を更新（更新後、自動で次のアイテムへ遷移）
  - 最後のアイテムでステータス更新時は次のテストケースへ自動遷移
  - ノート入力
  - 閉じるボタンでPiPウィンドウを閉じる
- **キーボード操作**
  - 矢印キーでナビゲーション可能

### 実行履歴一覧（ExecutionHistoryList）

- **表示場所**: テストスイート詳細の「実行履歴」タブ
- **表示要素**
  - ステータスバッジ
  - 開始日時
  - 終了日時（完了時のみ）
  - 実行者
  - 環境名
  - 結果サマリー（PASS/FAIL/SKIPPED/PENDING）
  - 詳細リンク
- **フィルタリング**
  - ステータス（IN_PROGRESS/COMPLETED/ABORTED）
  - 日付範囲（開始日、終了日）
- **ページネーション**: 20件ずつ

## 業務フロー

### 実行開始フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース
    participant S as MinIO

    U->>F: 「実行開始」ボタンをクリック
    F->>U: 環境選択モーダル表示
    U->>F: 環境を選択（任意）
    U->>F: 「開始」ボタンをクリック
    F->>B: POST /api/test-suites/{id}/executions
    B->>B: 権限確認（WRITE以上）
    B->>DB: テストスイート・テストケース取得
    B->>DB: Execution作成
    B->>DB: ExecutionTestSuite作成（スナップショット）
    B->>DB: ExecutionTestSuitePrecondition作成
    B->>DB: ExecutionTestCase作成
    B->>DB: ExecutionTestCasePrecondition作成
    B->>DB: ExecutionTestCaseStep作成
    B->>DB: ExecutionTestCaseExpectedResult作成
    B->>DB: ExecutionPreconditionResult作成
    B->>DB: ExecutionStepResult作成
    B->>DB: ExecutionExpectedResult作成
    B->>F: 実行情報
    F->>U: 実行画面へ遷移
```

### 結果更新フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース

    U->>F: ステータスボタンをクリック
    F->>F: 楽観的更新（即座にUI反映）
    F->>B: PATCH /api/executions/{id}/...
    B->>B: 権限確認（WRITE以上）
    B->>B: 実行ステータス確認（IN_PROGRESS）
    B->>DB: 結果レコード更新
    B->>F: 更新結果
    alt 成功
        F->>U: UI維持
    else 失敗
        F->>F: ロールバック
        F->>U: エラートースト表示
    end
```

### エビデンスアップロードフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース
    participant S as MinIO

    U->>F: ファイルをドロップ/選択
    F->>F: ファイルサイズ・タイプ検証
    F->>B: POST /api/executions/{id}/expected-results/{id}/evidences
    B->>B: 権限確認（WRITE以上）
    B->>B: 実行ステータス確認（IN_PROGRESS）
    B->>B: エビデンス数上限確認（10件）
    B->>S: ファイルアップロード
    B->>DB: ExecutionEvidence作成
    B->>F: エビデンス情報
    F->>U: 一覧に追加表示
```

### エビデンスダウンロードフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant S as MinIO

    U->>F: ダウンロードボタンをクリック
    F->>B: GET /api/executions/{id}/evidences/{id}/download-url
    B->>B: 権限確認（READ以上）
    B->>S: 署名付きURL生成（1時間有効）
    B->>F: ダウンロードURL
    F->>U: 新しいタブでURLを開く
    U->>S: ファイルダウンロード
```

### 実行完了/中止フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant B as バックエンド
    participant DB as データベース

    U->>F: 「完了」または「中止」ボタンをクリック
    F->>B: POST /api/executions/{id}/complete または /abort
    B->>B: 権限確認（WRITE以上）
    B->>B: 実行ステータス確認（IN_PROGRESS）
    B->>DB: status更新（COMPLETED/ABORTED）
    B->>DB: completedAt設定
    B->>F: 更新結果
    F->>U: ステータス表示更新、編集無効化
```

## データモデル

```mermaid
erDiagram
    TestSuite ||--o{ Execution : "runs"
    ProjectEnvironment ||--o{ Execution : "uses"
    User ||--o{ Execution : "executes"
    AgentSession ||--o{ Execution : "executes"
    Execution ||--|| ExecutionTestSuite : "has"
    ExecutionTestSuite ||--o{ ExecutionTestSuitePrecondition : "has"
    ExecutionTestSuite ||--o{ ExecutionTestCase : "has"
    ExecutionTestCase ||--o{ ExecutionTestCasePrecondition : "has"
    ExecutionTestCase ||--o{ ExecutionTestCaseStep : "has"
    ExecutionTestCase ||--o{ ExecutionTestCaseExpectedResult : "has"
    Execution ||--o{ ExecutionPreconditionResult : "has"
    Execution ||--o{ ExecutionStepResult : "has"
    Execution ||--o{ ExecutionExpectedResult : "has"
    ExecutionExpectedResult ||--o{ ExecutionEvidence : "has"

    Execution {
        uuid id PK
        uuid testSuiteId FK
        uuid environmentId FK "nullable"
        uuid executedByUserId FK "nullable"
        uuid executedByAgentSessionId FK "nullable"
        enum status "IN_PROGRESS, COMPLETED, ABORTED"
        timestamp startedAt
        timestamp completedAt "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    ExecutionTestSuite {
        uuid id PK
        uuid executionId FK "unique"
        uuid originalTestSuiteId
        string name
        text description "nullable"
        timestamp createdAt
    }

    ExecutionTestSuitePrecondition {
        uuid id PK
        uuid executionTestSuiteId FK
        uuid originalPreconditionId
        text content
        string orderKey
        timestamp createdAt
    }

    ExecutionTestCase {
        uuid id PK
        uuid executionTestSuiteId FK
        uuid originalTestCaseId
        string title
        text description "nullable"
        enum priority
        string orderKey
        timestamp createdAt
    }

    ExecutionTestCasePrecondition {
        uuid id PK
        uuid executionTestCaseId FK
        uuid originalPreconditionId
        text content
        string orderKey
        timestamp createdAt
    }

    ExecutionTestCaseStep {
        uuid id PK
        uuid executionTestCaseId FK
        uuid originalStepId
        text content
        string orderKey
        timestamp createdAt
    }

    ExecutionTestCaseExpectedResult {
        uuid id PK
        uuid executionTestCaseId FK
        uuid originalExpectedResultId
        text content
        string orderKey
        timestamp createdAt
    }

    ExecutionPreconditionResult {
        uuid id PK
        uuid executionId FK
        uuid executionTestCaseId FK "nullable"
        uuid executionSuitePreconditionId FK "nullable"
        uuid executionCasePreconditionId FK "nullable"
        enum status "UNCHECKED, MET, NOT_MET"
        timestamp checkedAt "nullable"
        uuid checkedByUserId FK "nullable, 確認者ユーザーID"
        varchar checkedByAgentName "nullable, 確認者AIエージェント名"
        text note "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    ExecutionStepResult {
        uuid id PK
        uuid executionId FK
        uuid executionTestCaseId FK
        uuid executionStepId FK
        enum status "PENDING, DONE, SKIPPED"
        timestamp executedAt "nullable"
        uuid executedByUserId FK "nullable, 実施者ユーザーID"
        varchar executedByAgentName "nullable, 実施者AIエージェント名"
        text note "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    ExecutionExpectedResult {
        uuid id PK
        uuid executionId FK
        uuid executionTestCaseId FK
        uuid executionExpectedResultId FK
        enum status "PENDING, PASS, FAIL, SKIPPED, NOT_EXECUTABLE"
        timestamp judgedAt "nullable"
        uuid judgedByUserId FK "nullable, 判定者ユーザーID"
        varchar judgedByAgentName "nullable, 判定者AIエージェント名"
        text note "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    ExecutionEvidence {
        uuid id PK
        uuid expectedResultId FK
        string fileName "VARCHAR(255)"
        string fileUrl
        string fileType "VARCHAR(100)"
        bigint fileSize
        text description "nullable"
        uuid uploadedByUserId FK "nullable"
        uuid uploadedByAgentSessionId FK "nullable"
        timestamp createdAt
    }
```

### 正規化テーブルによるスナップショット

実行開始時に、テストスイートとテストケースの状態を正規化テーブル群に保存します。JSONBではなく正規化テーブルを使用することで、データの整合性とクエリ性能が向上します。

```
Execution
    │
    └──1:1── ExecutionTestSuite
                 │
                 ├──1:N── ExecutionTestSuitePrecondition
                 │
                 └──1:N── ExecutionTestCase
                              │
                              ├──1:N── ExecutionTestCasePrecondition
                              ├──1:N── ExecutionTestCaseStep
                              └──1:N── ExecutionTestCaseExpectedResult
```

各スナップショットテーブルは元のテーブルのIDを`original*Id`として保持し、実行時点のデータをコピーします。

### ステータス定義

#### 実行ステータス (ExecutionStatus)

| ステータス | 説明 | 用途 |
|-----------|------|------|
| IN_PROGRESS | 実行中 | 結果入力可能、エビデンスアップロード可能 |
| COMPLETED | 完了 | 結果確定、閲覧のみ |
| ABORTED | 中断 | 途中終了、閲覧のみ |

#### 前提条件ステータス (PreconditionStatus)

| ステータス | 説明 |
|-----------|------|
| UNCHECKED | 未確認 |
| MET | 満たされている |
| NOT_MET | 満たされていない |

#### ステップステータス (StepStatus)

| ステータス | 説明 |
|-----------|------|
| PENDING | 未実施 |
| DONE | 実施済み |
| SKIPPED | スキップ |

#### 判定ステータス (JudgmentStatus)

| ステータス | 説明 |
|-----------|------|
| PENDING | 未判定 |
| PASS | 合格 |
| FAIL | 不合格 |
| SKIPPED | スキップ |
| NOT_EXECUTABLE | 実行不可 |

## ビジネスルール

### 実行開始

- WRITE以上のロールが必要
- 実行開始時にテストスイートとすべてのテストケースの状態をスナップショットとして保存
- スナップショットは実行中のテストスイート編集に影響されない
- 環境選択は任意（未選択でも実行可能）

### 結果更新

- WRITE以上のロールが必要
- ステータスがIN_PROGRESSの実行のみ更新可能
- 楽観的更新によりUI遅延を最小化
- ノートは任意入力

### 実行完了/中止

- WRITE以上のロールが必要
- IN_PROGRESSの実行のみ完了/中止可能
- 完了/中止後は結果の変更不可
- 完了/中止後もエビデンスの閲覧は可能

### 実施者情報の記録

テスト実行中の各操作には、誰がいつ実施したかの情報が記録される。

#### 記録タイミング

| 操作 | 記録フィールド | 記録タイミング |
|------|--------------|--------------|
| 前提条件確認 | checkedByUserId, checkedByAgentName, checkedAt | ステータス変更時 |
| 手順実施 | executedByUserId, executedByAgentName, executedAt | ステータス変更時 |
| 期待結果判定 | judgedByUserId, judgedByAgentName, judgedAt | ステータス変更時 |

#### 実施者の特定方法

| 実施経路 | userId | agentName |
|---------|--------|-----------|
| Webブラウザ | ログインユーザーID | null |
| MCPツール | 認証ユーザーID | ツールで指定した名前（例: "Claude Code Opus4.5"） |

#### UI表示形式

実施者情報は以下の形式で表示される:
- ユーザー実施: `田中太郎 / 2025-01-15 10:30`
- AIエージェント実施: `Claude Code Opus4.5 / 2025-01-15 10:30`

エージェント名が設定されている場合はエージェント名を優先表示する。これにより、MCPツール経由でAIエージェントが実施した場合に、どのエージェントが作業したかを明確に識別できる。

### エビデンス管理

- アップロード: WRITE以上のロール、IN_PROGRESSの実行のみ
- 削除: WRITE以上のロール、IN_PROGRESSの実行のみ
- ダウンロード: READ以上のロール、どのステータスでも可能
- 1期待結果あたり最大10ファイル

#### アップロード方法

| 方法 | エンドポイント | 形式 | 用途 |
|------|----------------|------|------|
| Web API | POST /api/executions/:id/expected-results/:resultId/evidences | multipart/form-data | Webフロントエンド |
| MCP ツール | upload_execution_evidence | Base64 JSON | AIエージェント |
| 内部API | POST /internal/api/executions/:id/expected-results/:resultId/evidences | Base64 JSON | MCP↔API間連携 |

MCPツール経由でのアップロードでは、ファイルをBase64エンコードして送信する。express.jsonの50MB制限により、実質約37MBまでのファイルが送信可能。

### ファイルアップロード制限

| 項目 | 制限値 |
|------|--------|
| ファイルサイズ上限 | 100MB |
| 1期待結果あたりのファイル数 | 10件 |

### 許可ファイルタイプ

- 画像: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/bmp
- 動画: video/mp4, video/webm, video/quicktime, video/x-msvideo
- 音声: audio/mpeg, audio/wav, audio/ogg, audio/webm
- ドキュメント: application/pdf, text/plain, text/csv, application/json, application/zip

### MinIOストレージ構造

```
agentest/
└── evidences/
    └── {executionId}/
        └── {expectedResultId}/
            └── {uuid}_{originalFilename}
```

## 権限

### プロジェクトロール（実行操作に必要）

| ロール | 説明 |
|--------|------|
| OWNER | プロジェクトオーナー（最高権限） |
| ADMIN | 管理者 |
| WRITE | 編集者（実行・結果記録可能） |
| READ | 閲覧者（閲覧のみ） |

### 操作別権限

| 操作 | OWNER | ADMIN | WRITE | READ |
|------|:-----:|:-----:|:-----:|:----:|
| 実行詳細閲覧 | ✓ | ✓ | ✓ | ✓ |
| 実行開始 | ✓ | ✓ | ✓ | - |
| 実行中止 | ✓ | ✓ | ✓ | - |
| 実行完了 | ✓ | ✓ | ✓ | - |
| 結果更新（前提条件/ステップ/期待値） | ✓ | ✓ | ✓ | - |
| エビデンスアップロード | ✓ | ✓ | ✓ | - |
| エビデンス削除 | ✓ | ✓ | ✓ | - |
| エビデンスダウンロード | ✓ | ✓ | ✓ | ✓ |
| 実行履歴閲覧 | ✓ | ✓ | ✓ | ✓ |

## 設定値

| 項目 | 値 | 説明 |
|------|-----|------|
| MAX_FILE_SIZE | 100MB (104857600) | エビデンスファイルサイズ上限 |
| MAX_EVIDENCES_PER_RESULT | 10 | 1期待結果あたりのエビデンス上限 |
| DOWNLOAD_URL_EXPIRES_IN | 3600秒 (1時間) | 署名付きダウンロードURLの有効期限 |
| 実行履歴ページサイズ | 20件 | ページネーションのデフォルト件数 |
| 自動更新間隔 | 10秒 | 実行中の画面自動リフレッシュ間隔 |

## API エンドポイント

### 実行

| メソッド | パス | 説明 | 権限 |
|----------|------|------|------|
| POST | /api/test-suites/:id/executions | 実行開始 | WRITE以上 |
| GET | /api/test-suites/:id/executions | 実行履歴一覧 | READ以上 |
| GET | /api/executions/:id | 実行詳細取得（軽量） | READ以上 |
| GET | /api/executions/:id/details | 実行詳細取得（全データ） | READ以上 |
| POST | /api/executions/:id/abort | 実行中止 | WRITE以上 |
| POST | /api/executions/:id/complete | 実行完了 | WRITE以上 |

### 結果更新

| メソッド | パス | 説明 | 権限 |
|----------|------|------|------|
| PATCH | /api/executions/:id/preconditions/:resultId | 前提条件結果更新 | WRITE以上 |
| PATCH | /api/executions/:id/steps/:resultId | ステップ結果更新 | WRITE以上 |
| PATCH | /api/executions/:id/expected-results/:resultId | 期待結果更新 | WRITE以上 |

### エビデンス

| メソッド | パス | 説明 | 権限 |
|----------|------|------|------|
| POST | /api/executions/:id/expected-results/:resultId/evidences | エビデンスアップロード | WRITE以上 |
| DELETE | /api/executions/:id/evidences/:evidenceId | エビデンス削除 | WRITE以上 |
| GET | /api/executions/:id/evidences/:evidenceId/download-url | ダウンロードURL取得 | READ以上 |

### 実行履歴検索クエリパラメータ

| パラメータ | 型 | 説明 | デフォルト |
|-----------|-----|------|-----------|
| status | enum | ステータスフィルタ（IN_PROGRESS/COMPLETED/ABORTED） | - |
| fromDate | datetime | 開始日 | - |
| toDate | datetime | 終了日 | - |
| limit | number | 取得件数（1-100） | 20 |
| offset | number | オフセット | 0 |

## リクエスト・レスポンス仕様

### 実行開始

**リクエスト**
```json
{
  "environmentId": "uuid"  // 任意
}
```

**レスポンス**
```json
{
  "execution": {
    "id": "uuid",
    "testSuiteId": "uuid",
    "environmentId": "uuid",
    "status": "IN_PROGRESS",
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": null
  }
}
```

### 実行詳細取得（全データ）

**レスポンス**
```json
{
  "execution": {
    "id": "uuid",
    "testSuiteId": "uuid",
    "environmentId": "uuid",
    "status": "IN_PROGRESS",
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": null,
    "environment": {
      "id": "uuid",
      "name": "本番環境"
    },
    "executionTestSuite": {
      "id": "uuid",
      "originalTestSuiteId": "uuid",
      "name": "テストスイート名",
      "description": "説明",
      "preconditions": [
        {
          "id": "uuid",
          "originalPreconditionId": "uuid",
          "content": "前提条件内容",
          "orderKey": "00001"
        }
      ],
      "testCases": [
        {
          "id": "uuid",
          "originalTestCaseId": "uuid",
          "title": "テストケース名",
          "description": "説明",
          "priority": "HIGH",
          "orderKey": "00001",
          "preconditions": [
            {
              "id": "uuid",
              "originalPreconditionId": "uuid",
              "content": "ケース前提条件",
              "orderKey": "00001"
            }
          ],
          "steps": [
            {
              "id": "uuid",
              "originalStepId": "uuid",
              "content": "操作手順",
              "orderKey": "00001"
            }
          ],
          "expectedResults": [
            {
              "id": "uuid",
              "originalExpectedResultId": "uuid",
              "content": "期待結果",
              "orderKey": "00001"
            }
          ]
        }
      ]
    },
    "preconditionResults": [
      {
        "id": "uuid",
        "executionTestCaseId": null,
        "executionSuitePreconditionId": "uuid",
        "executionCasePreconditionId": null,
        "status": "MET",
        "checkedAt": "2024-01-01T00:00:00Z",
        "checkedByUser": {
          "id": "uuid",
          "name": "田中太郎",
          "avatarUrl": "https://..."
        },
        "checkedByAgentName": null,
        "note": null
      }
    ],
    "stepResults": [
      {
        "id": "uuid",
        "executionTestCaseId": "uuid",
        "executionStepId": "uuid",
        "status": "DONE",
        "executedAt": "2024-01-01T00:00:00Z",
        "executedByUser": null,
        "executedByAgentName": "Claude Code Opus4.5",
        "note": null
      }
    ],
    "expectedResults": [
      {
        "id": "uuid",
        "executionTestCaseId": "uuid",
        "executionExpectedResultId": "uuid",
        "status": "PASS",
        "judgedAt": "2024-01-01T00:00:00Z",
        "judgedByUser": null,
        "judgedByAgentName": "Claude Code Opus4.5",
        "note": null,
        "evidences": [
          {
            "id": "uuid",
            "fileName": "screenshot.png",
            "fileType": "image/png",
            "fileSize": 12345,
            "description": "エラー画面のスクリーンショット",
            "createdAt": "2024-01-01T00:00:00Z"
          }
        ]
      }
    ]
  }
}
```

### 結果更新

**リクエスト（共通）**
```json
{
  "status": "PASS",  // 各結果タイプに応じたステータス
  "note": "メモ"     // 任意
}
```

**レスポンス**
```json
{
  "result": {
    "id": "uuid",
    "status": "PASS",
    "note": "メモ",
    "judgedAt": "2024-01-01T00:00:00Z"
  }
}
```

### エビデンスアップロード

**リクエスト**: multipart/form-data
- `file`: ファイル（必須）
- `description`: 説明（任意）

**レスポンス**
```json
{
  "evidence": {
    "id": "uuid",
    "fileName": "screenshot.png",
    "fileType": "image/png",
    "fileSize": 12345,
    "description": "エラー画面のスクリーンショット",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### エビデンスダウンロードURL取得

**レスポンス**
```json
{
  "downloadUrl": "https://minio.example.com/agentest/evidences/...?signature=..."
}
```

### 実行履歴一覧

**レスポンス**
```json
{
  "executions": [
    {
      "id": "uuid",
      "testSuiteId": "uuid",
      "environmentId": "uuid",
      "status": "COMPLETED",
      "startedAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T01:00:00Z",
      "environment": {
        "id": "uuid",
        "name": "本番環境"
      },
      "executedByUser": {
        "id": "uuid",
        "name": "テスター",
        "avatarUrl": "https://..."
      },
      "_count": {
        "expectedResults": 10
      },
      "passCount": 8,
      "failCount": 1,
      "skipCount": 1
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

## フロントエンドコンポーネント

テスト実行画面を構成する主要コンポーネント一覧。

| 分類 | コンポーネント | ファイルパス | 説明 |
|------|---------------|--------------|------|
| ページ | ExecutionPage | `apps/web/src/pages/Execution.tsx` | メインページ、状態管理・API連携 |
| サイドバー | ExecutionSidebar | `apps/web/src/components/execution/ExecutionSidebar.tsx` | テストケース一覧・選択 |
| 概要パネル | ExecutionOverviewPanel | `apps/web/src/components/execution/ExecutionOverviewPanel.tsx` | 実行概要・サマリー表示 |
| 詳細パネル | ExecutionTestCaseDetailPanel | `apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx` | テストケース詳細表示 |
| リスト | ExecutionPreconditionList | `apps/web/src/components/execution/ExecutionPreconditionList.tsx` | 前提条件一覧 |
| リスト | ExecutionStepList | `apps/web/src/components/execution/ExecutionStepList.tsx` | ステップ一覧 |
| リスト | ExecutionExpectedResultList | `apps/web/src/components/execution/ExecutionExpectedResultList.tsx` | 期待結果一覧 |
| エビデンス | ExecutionEvidenceList | `apps/web/src/components/execution/ExecutionEvidenceList.tsx` | エビデンス一覧・削除・ダウンロード |
| エビデンス | ExecutionEvidenceUpload | `apps/web/src/components/execution/ExecutionEvidenceUpload.tsx` | ドラッグ&ドロップアップロード |
| UI部品 | ExecutionResultItem | `apps/web/src/components/execution/ExecutionResultItem.tsx` | 結果項目（番号・内容・ステータス・実施者情報） |
| UI部品 | StatusButton | `apps/web/src/components/execution/StatusButton.tsx` | ステータス変更ドロップダウン |
| PiP | PipPortal | `apps/web/src/components/execution/PipPortal.tsx` | PiPウィンドウへのポータル |
| PiP | PipExecutionPanel | `apps/web/src/components/execution/PipExecutionPanel.tsx` | PiP用コンパクトUI |
| Hook | usePictureInPicture | `apps/web/src/hooks/usePictureInPicture.ts` | Document PiP APIラッパー |
| 定数 | execution-status | `apps/web/src/lib/execution-status.ts` | ステータス定義・アイコン・色 |

## 関連機能

- [テストスイート管理](./test-suite-management.md) - 実行対象のテストスイート
- [テストケース管理](./test-case-management.md) - 実行対象のテストケース
- [プロジェクト管理](./project-management.md) - 環境設定の参照元
- [監査ログ](./audit-log.md) - 実行操作の記録
