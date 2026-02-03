import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { Input } from './Input.js';

describe('Input', () => {
  describe('レンダリング', () => {
    it('input要素をレンダリングする', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('ラベルなしでレンダリングできる', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });
  });

  describe('ラベル', () => {
    it('labelを表示する', () => {
      render(<Input label="Username" />);
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('labelとinputがhtmlFor/idで関連付けられる', () => {
      render(<Input label="Email Address" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email Address');
      expect(input).toHaveAttribute('id', 'email-address');
      expect(label).toHaveAttribute('for', 'email-address');
    });

    it('カスタムidを渡した場合はそれを使用する', () => {
      render(<Input label="Username" id="custom-id" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('エラー状態', () => {
    it('エラーメッセージを表示する', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('エラー時に赤いボーダーのクラスを持つ', () => {
      render(<Input error="Error" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
    });

    it('エラーがない場合は通常のボーダーのクラスを持つ', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-zinc-300');
    });

    it('エラー時はhelperTextを表示しない', () => {
      render(<Input error="Error" helperText="This is helper text" />);
      expect(screen.queryByText('This is helper text')).not.toBeInTheDocument();
    });
  });

  describe('ヘルパーテキスト', () => {
    it('helperTextを表示する', () => {
      render(<Input helperText="Enter your username" />);
      expect(screen.getByText('Enter your username')).toBeInTheDocument();
    });

    it('エラーがない場合のみhelperTextを表示する', () => {
      render(<Input helperText="Helper" />);
      expect(screen.getByText('Helper')).toBeInTheDocument();
    });
  });

  describe('disabled状態', () => {
    it('disabled=trueのときinputがdisabledになる', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('disabled=falseのときinputがenabledになる', () => {
      render(<Input disabled={false} />);
      const input = screen.getByRole('textbox');
      expect(input).not.toBeDisabled();
    });

    it('disabled時のスタイルクラスを持つ', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('disabled:bg-zinc-50');
    });
  });

  describe('イベントハンドリング', () => {
    it('onChangeが呼び出される', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('onFocusが呼び出される', () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('onBlurが呼び出される', () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('forwardRef', () => {
    it('refをinput要素に渡せる', () => {
      const ref = createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('refを通じてDOMメソッドにアクセスできる', () => {
      const ref = createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe('カスタムプロパティ', () => {
    it('カスタムclassNameを追加できる', () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
    });

    it('type属性を渡せる', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('placeholder属性を渡せる', () => {
      render(<Input placeholder="Enter text here" />);
      expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
    });

    it('value属性を渡せる', () => {
      render(<Input value="initial value" onChange={() => {}} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('initial value');
    });

    it('data-testidを渡せる', () => {
      render(<Input data-testid="custom-input" />);
      expect(screen.getByTestId('custom-input')).toBeInTheDocument();
    });

    it('name属性を渡せる', () => {
      render(<Input name="username" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('name', 'username');
    });
  });

  describe('アクセシビリティ', () => {
    it('textbox roleを持つ', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('フォーカスリングのクラスを持つ', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus:ring-2');
    });

    it('labelがある場合、スクリーンリーダーがラベルを読み上げられる', () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeInTheDocument();
    });

    it('エラー時にaria-invalid="true"が設定される', () => {
      render(<Input label="Email" error="Invalid email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('エラーがない場合はaria-invalidが設定されない', () => {
      render(<Input label="Email" />);
      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('エラーメッセージがaria-describedbyで関連付けられる', () => {
      render(<Input label="Email" error="Invalid email" />);
      const input = screen.getByRole('textbox');
      const errorMessage = screen.getByText('Invalid email');
      expect(input).toHaveAttribute('aria-describedby', 'email-error');
      expect(errorMessage).toHaveAttribute('id', 'email-error');
    });

    it('ヘルパーテキストがaria-describedbyで関連付けられる', () => {
      render(<Input label="Email" helperText="Enter your email address" />);
      const input = screen.getByRole('textbox');
      const helperText = screen.getByText('Enter your email address');
      expect(input).toHaveAttribute('aria-describedby', 'email-helper');
      expect(helperText).toHaveAttribute('id', 'email-helper');
    });

    it('エラーメッセージにrole="alert"が設定される', () => {
      render(<Input label="Email" error="Invalid email" />);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Invalid email');
    });

    it('カスタムidを使用した場合もaria-describedbyが正しく設定される', () => {
      render(<Input id="my-input" error="Error message" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'my-input-error');
    });
  });
});
