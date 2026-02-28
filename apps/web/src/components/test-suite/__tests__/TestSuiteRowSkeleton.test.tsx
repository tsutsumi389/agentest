import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestSuiteRowSkeleton } from '../TestSuiteRowSkeleton';

describe('TestSuiteRowSkeleton', () => {
  it('デフォルトで5行表示される', () => {
    render(<TestSuiteRowSkeleton />);

    const items = screen.getAllByTestId('test-suite-row-skeleton-item');
    expect(items).toHaveLength(5);
  });

  it('count propsで行数を制御できる', () => {
    render(<TestSuiteRowSkeleton count={3} />);

    const items = screen.getAllByTestId('test-suite-row-skeleton-item');
    expect(items).toHaveLength(3);
  });

  it('各行にSkeleton要素（role="status"）が含まれる', () => {
    render(<TestSuiteRowSkeleton count={1} />);

    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
