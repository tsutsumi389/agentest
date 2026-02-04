import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * テスト用QueryClientを生成
 * リトライを無効化し、エラーログを抑制
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * React QueryのProviderラッパーを生成
 */
export function createQueryWrapper() {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper: Wrapper, queryClient };
}
