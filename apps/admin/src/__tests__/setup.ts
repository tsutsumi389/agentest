import '@testing-library/jest-dom/vitest';

// jsdomで未実装のAPIをモック
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
