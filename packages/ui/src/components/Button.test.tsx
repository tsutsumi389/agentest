import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  describe('レンダリング', () => {
    it('childrenを表示する', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('デフォルトのvariantはprimary', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-zinc-800');
    });

    it('デフォルトのsizeはmd', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2');
    });
  });

  describe('バリアント', () => {
    it('primaryバリアントのスタイルを適用する', () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-zinc-800', 'text-zinc-100');
    });

    it('secondaryバリアントのスタイルを適用する', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-zinc-200', 'text-zinc-900');
    });

    it('ghostバリアントのスタイルを適用する', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent', 'text-zinc-600');
    });

    it('dangerバリアントのスタイルを適用する', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-600', 'text-white');
    });
  });

  describe('サイズ', () => {
    it('smサイズのスタイルを適用する', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });

    it('mdサイズのスタイルを適用する', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
    });

    it('lgサイズのスタイルを適用する', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
    });
  });

  describe('ローディング状態', () => {
    it('loading=trueのときスピナーを表示する', () => {
      render(<Button loading>Loading</Button>);
      const svg = document.querySelector('svg.animate-spin');
      expect(svg).toBeInTheDocument();
    });

    it('loading=falseのときスピナーを表示しない', () => {
      render(<Button loading={false}>Not Loading</Button>);
      const svg = document.querySelector('svg.animate-spin');
      expect(svg).not.toBeInTheDocument();
    });

    it('loading=trueのときボタンがdisabledになる', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('disabled状態', () => {
    it('disabled=trueのときボタンがdisabledになる', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('disabled=falseのときボタンがenabledになる', () => {
      render(<Button disabled={false}>Enabled</Button>);
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('イベントハンドリング', () => {
    it('onClickが呼び出される', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disabled時はonClickが呼び出されない', () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('loading時はonClickが呼び出されない', () => {
      const handleClick = vi.fn();
      render(
        <Button loading onClick={handleClick}>
          Loading
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('カスタムプロパティ', () => {
    it('カスタムclassNameを追加できる', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('type属性を渡せる', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('data-testidを渡せる', () => {
      render(<Button data-testid="custom-button">Test</Button>);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('button roleを持つ', () => {
      render(<Button>Accessible</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('aria-disabledがdisabled状態を反映する', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('フォーカスリングのクラスを持つ', () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-offset-2');
    });
  });
});
