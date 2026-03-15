import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePreviewModal } from '../ImagePreviewModal';

describe('ImagePreviewModal', () => {
  const defaultProps = {
    isOpen: true,
    imageUrl: 'https://example.com/test.png',
    fileName: 'test.png',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=false のとき何も表示しない', () => {
    const { container } = render(<ImagePreviewModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true のとき画像とファイル名を表示する', () => {
    render(<ImagePreviewModal {...defaultProps} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', defaultProps.imageUrl);
    expect(img).toHaveAttribute('alt', defaultProps.fileName);
    expect(screen.getByText(defaultProps.fileName)).toBeInTheDocument();
  });

  it('背景クリックで onClose が呼ばれる', () => {
    render(<ImagePreviewModal {...defaultProps} />);

    // オーバーレイ（背景）をクリック
    const overlay = screen.getByTestId('image-preview-overlay');
    fireEvent.click(overlay);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('ESCキーで onClose が呼ばれる', () => {
    render(<ImagePreviewModal {...defaultProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('画像クリックでは onClose が呼ばれない（イベント伝播停止）', () => {
    render(<ImagePreviewModal {...defaultProps} />);

    const img = screen.getByRole('img');
    fireEvent.click(img);

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('画像読み込み失敗時にフォールバック表示される', () => {
    render(<ImagePreviewModal {...defaultProps} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    // フォールバックメッセージが表示される
    expect(screen.getByText('画像を読み込めませんでした')).toBeInTheDocument();
    // 元の画像要素は非表示
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('モーダルが開いている間、背景スクロールが無効化される', () => {
    const { unmount } = render(<ImagePreviewModal {...defaultProps} />);

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    // アンマウント後に復元される
    expect(document.body.style.overflow).toBe('');
  });
});
