// テスト用固定ID
export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_CASE_ID = '22222222-2222-2222-2222-222222222222';
export const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
export const TEST_PROJECT_ID = '44444444-4444-4444-4444-444444444444';

// 子エンティティID
export const PRECONDITION_ID = '55555555-5555-5555-5555-555555555555';
export const STEP_ID = '66666666-6666-6666-6666-666666666666';
export const EXPECTED_RESULT_ID = '77777777-7777-7777-7777-777777777777';

// テスト用テストケースモック
export const createMockTestCase = (overrides = {}) => ({
  id: TEST_CASE_ID,
  testSuiteId: TEST_SUITE_ID,
  title: 'テストケース',
  description: 'テスト説明',
  priority: 'MEDIUM',
  status: 'DRAFT',
  orderKey: '00001',
  deletedAt: null,
  testSuite: { id: TEST_SUITE_ID, name: 'スイート', projectId: TEST_PROJECT_ID },
  createdByUser: { id: TEST_USER_ID, name: 'User', avatarUrl: null },
  preconditions: [],
  steps: [],
  expectedResults: [],
  ...overrides,
});
