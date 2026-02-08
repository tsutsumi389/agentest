/**
 * APIサービス用ロガー（Pinoベース）
 *
 * AsyncLocalStorage経由でrequestIdを自動付与する
 */

import { createLogger, type Logger } from '@agentest/shared/logger';
import { getRequestId } from '../lib/request-context.js';

export const logger: Logger = createLogger({
  service: 'api',
  mixin: () => {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  },
});
