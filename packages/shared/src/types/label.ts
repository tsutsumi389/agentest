/**
 * ラベル（プロジェクト単位で管理）
 */
export interface Label {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string; // HEX形式 (#FFFFFF)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * テストスイートラベル（中間テーブル）
 */
export interface TestSuiteLabel {
  id: string;
  testSuiteId: string;
  labelId: string;
  createdAt: Date;
}

/**
 * ラベル公開情報（APIレスポンス用）
 */
export interface LabelPublic {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

/**
 * ラベル作成入力
 */
export interface LabelCreateInput {
  name: string;
  description?: string | null;
  color: string;
}

/**
 * ラベル更新入力
 */
export interface LabelUpdateInput {
  name?: string;
  description?: string | null;
  color?: string;
}

/**
 * テストスイートラベル一括更新入力
 */
export interface TestSuiteLabelsUpdateInput {
  labelIds: string[];
}
