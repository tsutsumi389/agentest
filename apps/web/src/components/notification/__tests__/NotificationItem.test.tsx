import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Notification } from '../../../lib/api';
import { NotificationItem } from '../NotificationItem';
import { createMockNotification } from '../../../__tests__/factories';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NotificationItem', () => {
  const defaultProps = {
    notification: createMockNotification(),
    onMarkAsRead: vi.fn(),
    onDelete: vi.fn(),
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderItem(overrides: { notification?: Notification; onClick?: () => void } = {}) {
    return render(
      <MemoryRouter>
        <NotificationItem {...defaultProps} {...overrides} />
      </MemoryRouter>,
    );
  }

  it('ORG_INVITATION クリックで招待ページにナビゲーションする', () => {
    const notification = createMockNotification({
      type: 'ORG_INVITATION',
      data: { inviteToken: 'token-abc' },
    });
    renderItem({ notification });

    fireEvent.click(screen.getByText('テスト通知'));

    expect(mockNavigate).toHaveBeenCalledWith('/invitations/token-abc');
  });

  it('data が null の場合、ナビゲーションしない', () => {
    const notification = createMockNotification({
      type: 'ORG_INVITATION',
      data: null,
    });
    renderItem({ notification });

    fireEvent.click(screen.getByText('テスト通知'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('未読通知クリックで onMarkAsRead が呼ばれる', () => {
    const notification = createMockNotification({ readAt: null });
    renderItem({ notification });

    fireEvent.click(screen.getByText('テスト通知'));

    expect(defaultProps.onMarkAsRead).toHaveBeenCalledWith('n-1');
  });

  it('既読通知クリックで onMarkAsRead が呼ばれない', () => {
    const notification = createMockNotification({
      readAt: '2024-01-02T00:00:00Z',
    });
    renderItem({ notification });

    fireEvent.click(screen.getByText('テスト通知'));

    expect(defaultProps.onMarkAsRead).not.toHaveBeenCalled();
  });

  it('onClick コールバックがクリック時に呼ばれる', () => {
    const notification = createMockNotification();
    renderItem({ notification });

    fireEvent.click(screen.getByText('テスト通知'));

    expect(defaultProps.onClick).toHaveBeenCalled();
  });
});
