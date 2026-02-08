import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// console.errorを抑制（ErrorBoundaryが内部で呼ぶため）
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** レンダー時に必ずエラーを投げるコンポーネント */
function ThrowError({ message }: { message: string }): never {
  throw new Error(message);
}

/** 正常にレンダーされるコンポーネント */
function NormalChild() {
  return <div>正常コンテンツ</div>;
}

describe('ErrorBoundary', () => {
  it('子コンポーネントが正常な場合はそのまま表示する', () => {
    render(
      <ErrorBoundary>
        <NormalChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('正常コンテンツ')).toBeInTheDocument();
  });

  it('子コンポーネントでエラーが発生した場合、フォールバックUIを表示する', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="テストエラー" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(
      screen.getByText(
        '予期しないエラーが発生しました。ページを再読み込みするか、しばらくしてから再度お試しください。',
      ),
    ).toBeInTheDocument();
  });

  it('エラー発生時にrole="alert"が設定される', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="テストエラー" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('エラー詳細を展開できる（開発環境）', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="詳細エラーメッセージ" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('エラー詳細')).toBeInTheDocument();
    expect(screen.getByText('詳細エラーメッセージ')).toBeInTheDocument();
  });

  it('カスタムfallbackが指定されている場合はそれを表示する', () => {
    render(
      <ErrorBoundary fallback={<div>カスタムエラー画面</div>}>
        <ThrowError message="テストエラー" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('カスタムエラー画面')).toBeInTheDocument();
    expect(screen.queryByText('エラーが発生しました')).not.toBeInTheDocument();
  });

  it('再試行ボタンでエラー状態をリセットできる', () => {
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('条件付きエラー');
      }
      return <div>復旧済み</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>,
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();

    // エラーを発生させないようにしてから再試行
    shouldThrow = false;
    fireEvent.click(screen.getByText('再試行'));

    expect(screen.getByText('復旧済み')).toBeInTheDocument();
  });

  it('ページを再読み込みボタンでwindow.location.reloadが呼ばれる', () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError message="テストエラー" />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText('ページを再読み込み'));
    expect(reloadMock).toHaveBeenCalled();

    // window.locationを復元
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });
});
