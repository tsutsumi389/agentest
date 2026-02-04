import { test as base } from '@playwright/test';
import { TestApiClient } from '../helpers/api-client';

type Fixtures = {
  apiClient: TestApiClient;
};

export const test = base.extend<Fixtures>({
  apiClient: async ({ request }, use) => {
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:3001';
    await use(new TestApiClient(request, apiUrl));
  },
});

export { expect } from '@playwright/test';
