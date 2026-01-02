import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const getProjectInputSchema = z.object({
  projectId: z.string().uuid().describe('プロジェクトID（必須）'),
});

type GetProjectInput = z.infer<typeof getProjectInputSchema>;

/**
 * 環境情報型
 */
interface ProjectEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  baseUrl: string | null;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * レスポンス型
 */
interface GetProjectResponse {
  project: {
    id: string;
    name: string;
    description: string | null;
    organizationId: string | null;
    organization: {
      id: string;
      name: string;
      slug: string;
    } | null;
    role: string;
    environments: ProjectEnvironment[];
    _count: {
      testSuites: number;
    };
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const getProjectHandler: ToolHandler<GetProjectInput, GetProjectResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<GetProjectResponse>(`/internal/api/projects/${input.projectId}`, {
    userId,
  });

  return response;
};

/**
 * ツール定義
 */
export const getProjectTool: ToolDefinition<GetProjectInput> = {
  name: 'get_project',
  description: 'プロジェクトの詳細情報を取得します。環境設定やテストスイート数も含まれます。',
  inputSchema: getProjectInputSchema,
  handler: getProjectHandler,
};
