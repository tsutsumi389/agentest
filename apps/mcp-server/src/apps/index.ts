import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolContext } from '../tools/index.js';
import { requestContext } from '../transport/streamable-http.js';
import { apiClient } from '../clients/api-client.js';
import type { SearchTestSuiteResponse } from './types.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'apps' });

// ディレクトリパスを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ビルドされたUIファイルのディレクトリ
// TypeScriptビルド後: dist/apps/index.js
// そこから見たViteの出力先: ../../dist/src/apps/test-suites-app/
// 実際のパス: dist/src/apps/test-suites-app/index.html
const DIST_DIR = path.resolve(__dirname, '../../dist/src/apps/test-suites-app');

// リソースURI
const TEST_SUITES_APP_RESOURCE_URI = 'ui://agentest/test-suites-app.html';

// 入力スキーマ
const showTestSuitesAppInputSchema = z.object({
  projectId: z
    .string()
    .uuid()
    .optional()
    .describe('特定プロジェクト内のテストスイートに絞り込む場合に指定'),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
    .optional()
    .describe('ステータスで絞り込み'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('取得件数（1-50、デフォルト: 20）'),
});

type ShowTestSuitesAppInput = z.infer<typeof showTestSuitesAppInputSchema>;

/**
 * MCPサーバーにAppsを登録
 */
export function registerApps(server: McpServer): void {
  // テストスイート一覧Appのツールを登録
  registerAppTool(
    server,
    'show_test_suites_app',
    {
      title: 'テストスイート一覧',
      description: `テストスイート一覧をインタラクティブなUIで表示します。

表示内容:
- テストスイート名、説明、ステータス
- 所属プロジェクト名
- テストケース数、前提条件数
- テスト実行を依頼するボタン

使用場面: ユーザーがテストスイートの一覧を確認したい場合や、テスト実行を開始したい場合に使用します。`,
      inputSchema: {
        projectId: showTestSuitesAppInputSchema.shape.projectId,
        status: showTestSuitesAppInputSchema.shape.status,
        limit: showTestSuitesAppInputSchema.shape.limit,
      },
      _meta: {
        ui: {
          resourceUri: TEST_SUITES_APP_RESOURCE_URI,
        },
      },
    },
    async (args) => {
      // AsyncLocalStorageからコンテキストを取得
      const ctx = requestContext.getStore();
      const context: ToolContext = {
        userId: ctx?.userId || '',
        agentSession: ctx?.agentSession,
      };

      if (!context.userId) {
        throw new Error('認証されていません');
      }

      // 内部APIを呼び出し
      const input = showTestSuitesAppInputSchema.parse(args) as ShowTestSuitesAppInput;
      const response = await apiClient.get<SearchTestSuiteResponse>(
        `/internal/api/users/${context.userId}/test-suites`,
        {
          projectId: input.projectId,
          status: input.status,
          limit: input.limit,
          offset: 0,
        }
      );

      // MCPコンテンツ形式で返す
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // テストスイートAppのUIリソースを登録
  registerAppResource(
    server,
    'Test Suites App',
    TEST_SUITES_APP_RESOURCE_URI,
    {
      description: 'テストスイート一覧のインタラクティブUI',
      mimeType: RESOURCE_MIME_TYPE,
    },
    async () => {
      // ビルドされたHTMLファイルを読み込む
      const htmlPath = path.join(DIST_DIR, 'index.html');

      let html: string;
      try {
        html = await fs.readFile(htmlPath, 'utf-8');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`UIファイルの読み込みに失敗しました: ${htmlPath} - ${message}`);
      }

      return {
        contents: [
          {
            uri: TEST_SUITES_APP_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      };
    }
  );

  logger.info('MCP Appsを登録しました');
}
