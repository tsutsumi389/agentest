import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionEvidenceList } from '../ExecutionEvidenceList';
import type { ExecutionEvidence } from '../../../lib/api';

// ImagePreviewModal のモック
vi.mock('../../common/ImagePreviewModal', () => ({
  ImagePreviewModal: ({ isOpen, imageUrl, fileName, onClose }: {
    isOpen: boolean;
    imageUrl: string;
    fileName: string;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="image-preview-modal">
        <span data-testid="preview-image-url">{imageUrl}</span>
        <span data-testid="preview-file-name">{fileName}</span>
        <button data-testid="close-preview" onClick={onClose}>閉じる</button>
      </div>
    ) : null,
}));

const createEvidence = (overrides: Partial<ExecutionEvidence> = {}): ExecutionEvidence => ({
  id: 'evidence-1',
  expectedResultId: 'result-1',
  fileName: 'screenshot.png',
  fileType: 'image/png',
  fileSize: '1024',
  fileUrl: '/path/to/file',
  description: null,
  downloadUrl: 'https://example.com/screenshot.png',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('ExecutionEvidenceList', () => {
  const defaultProps = {
    evidences: [createEvidence()],
    isEditable: true,
    deletingId: null,
    downloadingId: null,
    onDelete: vi.fn(),
    onDownload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('エビデンスがない場合は何も表示しない', () => {
    const { container } = render(
      <ExecutionEvidenceList {...defaultProps} evidences={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  describe('サムネイルサイズ', () => {
    it('画像サムネイルが w-16 h-16 で表示される', () => {
      render(<ExecutionEvidenceList {...defaultProps} />);

      // サムネイルコンテナが w-16 h-16 クラスを持つことを確認
      const thumbnailContainer = screen.getByRole('img').closest('div');
      expect(thumbnailContainer).toHaveClass('w-16', 'h-16');
    });
  });

  describe('画像プレビューモーダル', () => {
    it('サムネイルクリックでプレビューモーダルが開く', () => {
      render(<ExecutionEvidenceList {...defaultProps} />);

      // モーダルが初期状態で表示されていないことを確認
      expect(screen.queryByTestId('image-preview-modal')).not.toBeInTheDocument();

      // サムネイルをクリック
      const thumbnail = screen.getByRole('img');
      fireEvent.click(thumbnail);

      // モーダルが表示される
      expect(screen.getByTestId('image-preview-modal')).toBeInTheDocument();
      expect(screen.getByTestId('preview-image-url')).toHaveTextContent('https://example.com/screenshot.png');
      expect(screen.getByTestId('preview-file-name')).toHaveTextContent('screenshot.png');
    });

    it('モーダルを閉じることができる', () => {
      render(<ExecutionEvidenceList {...defaultProps} />);

      // サムネイルクリックでモーダルを開く
      fireEvent.click(screen.getByRole('img'));
      expect(screen.getByTestId('image-preview-modal')).toBeInTheDocument();

      // モーダルを閉じる
      fireEvent.click(screen.getByTestId('close-preview'));
      expect(screen.queryByTestId('image-preview-modal')).not.toBeInTheDocument();
    });

    it('サムネイルに cursor-pointer クラスがある', () => {
      render(<ExecutionEvidenceList {...defaultProps} />);

      const thumbnailContainer = screen.getByRole('img').closest('div');
      expect(thumbnailContainer).toHaveClass('cursor-pointer');
    });
  });

  describe('非画像ファイル', () => {
    it('非画像ファイルにはプレビュー機能がない', () => {
      const textEvidence = createEvidence({
        id: 'evidence-2',
        fileName: 'report.pdf',
        fileType: 'application/pdf',
        downloadUrl: null,
      });

      render(
        <ExecutionEvidenceList {...defaultProps} evidences={[textEvidence]} />
      );

      // サムネイル画像が存在しない
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
