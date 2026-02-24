import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionExpectedResultList } from '../ExecutionExpectedResultList';
import type {
  ExecutionTestCaseExpectedResultSnapshot,
  ExecutionExpectedResult,
} from '../../../lib/api';

// 子コンポーネントのモック
vi.mock('../ExecutionResultItem', () => ({
  ExecutionResultItem: ({ content, index }: { content: string; index: number }) => (
    <div data-testid={`result-item-${index}`}>{content}</div>
  ),
}));

vi.mock('../ExecutionEvidenceList', () => ({
  ExecutionEvidenceList: () => <div data-testid="evidence-list" />,
}));

vi.mock('../ExecutionEvidenceUpload', () => ({
  ExecutionEvidenceUpload: () => <div data-testid="evidence-upload" />,
}));

const createExpectedResult = (id: string, content: string): ExecutionTestCaseExpectedResultSnapshot => ({
  id,
  executionTestCaseId: 'tc-1',
  originalExpectedResultId: 'orig-1',
  content,
  orderKey: 'a',
  createdAt: '2024-01-01T00:00:00Z',
});

const createResult = (id: string, expectedResultId: string): ExecutionExpectedResult => ({
  id,
  executionId: 'exec-1',
  executionTestCaseId: 'tc-1',
  executionExpectedResultId: expectedResultId,
  status: 'PENDING',
  note: null,
  judgedAt: null,
  evidences: [],
});

describe('ExecutionExpectedResultList', () => {
  const defaultProps = {
    expectedResults: [createExpectedResult('er-1', '正常に表示される')],
    results: [createResult('result-1', 'er-1')],
    isEditable: true,
    updatingStatusId: null,
    updatingNoteId: null,
    onStatusChange: vi.fn(),
    onNoteChange: vi.fn(),
    uploadingEvidenceResultId: null,
    deletingEvidenceId: null,
    downloadingEvidenceId: null,
    onEvidenceUpload: vi.fn(),
    onEvidenceDelete: vi.fn(),
    onEvidenceDownload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('アップロード領域の折りたたみ', () => {
    it('初期状態でアップロード領域が表示されない', () => {
      render(<ExecutionExpectedResultList {...defaultProps} />);

      expect(screen.queryByTestId('evidence-upload')).not.toBeInTheDocument();
    });

    it('「エビデンスを追加」ボタンが表示される', () => {
      render(<ExecutionExpectedResultList {...defaultProps} />);

      expect(screen.getByText('エビデンスを追加')).toBeInTheDocument();
    });

    it('「エビデンスを追加」ボタンクリックでアップロード領域が展開される', () => {
      render(<ExecutionExpectedResultList {...defaultProps} />);

      fireEvent.click(screen.getByText('エビデンスを追加'));

      expect(screen.getByTestId('evidence-upload')).toBeInTheDocument();
    });

    it('再度クリックでアップロード領域が閉じる', () => {
      render(<ExecutionExpectedResultList {...defaultProps} />);

      // 開く
      fireEvent.click(screen.getByText('エビデンスを追加'));
      expect(screen.getByTestId('evidence-upload')).toBeInTheDocument();

      // 閉じる
      fireEvent.click(screen.getByText('エビデンスを追加'));
      expect(screen.queryByTestId('evidence-upload')).not.toBeInTheDocument();
    });

    it('isEditable=false のとき「エビデンスを追加」ボタンが表示されない', () => {
      render(
        <ExecutionExpectedResultList {...defaultProps} isEditable={false} />
      );

      expect(screen.queryByText('エビデンスを追加')).not.toBeInTheDocument();
    });
  });
});
