/**
 * MCPサーバーがサポートするスコープ一覧
 */
export const SUPPORTED_SCOPES = [
  'mcp:read',
  'mcp:write',
  'project:read',
  'project:write',
  'test-suite:read',
  'test-suite:write',
  'test-case:read',
  'test-case:write',
  'execution:read',
  'execution:write',
] as const;

export type SupportedScope = (typeof SUPPORTED_SCOPES)[number];
