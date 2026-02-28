import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestCaseSidebarSkeleton } from '../TestCaseSidebarSkeleton';

describe('TestCaseSidebarSkeleton', () => {
  it('デフォルトで5件表示される', () => {
    render(<TestCaseSidebarSkeleton />);

    const items = screen.getAllByTestId('test-case-sidebar-skeleton-item');
    expect(items).toHaveLength(5);
  });

  it('count propsで件数を制御できる', () => {
    render(<TestCaseSidebarSkeleton count={3} />);

    const items = screen.getAllByTestId('test-case-sidebar-skeleton-item');
    expect(items).toHaveLength(3);
  });

  it('各行にSkeleton要素（role="status"）が含まれる', () => {
    render(<TestCaseSidebarSkeleton count={1} />);

    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
