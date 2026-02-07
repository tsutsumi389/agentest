/**
 * MCPサーバー用ロガー（Pinoベース）
 */

import { createLogger, type Logger } from '@agentest/shared/logger';

export const logger: Logger = createLogger({ service: 'mcp' });
