import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Terminal/CLI風のカラーパレット（GitHub Dark準拠）
        background: {
          DEFAULT: '#0d1117',
          secondary: '#161b22',
          tertiary: '#21262d',
          canvas: '#010409', // 最背面用
        },
        foreground: {
          DEFAULT: '#e6edf3', // コントラスト向上（WCAG AA準拠）
          muted: '#8b949e',
          subtle: '#6e7681',
          disabled: '#484f58', // 無効状態用
        },
        border: {
          DEFAULT: '#30363d',
          muted: '#21262d',
          emphasis: '#8b949e', // 強調ボーダー
        },
        accent: {
          DEFAULT: '#58a6ff',
          hover: '#79c0ff',
          muted: '#388bfd',
          subtle: '#121d2f', // 背景用
        },
        success: {
          DEFAULT: '#3fb950',
          muted: '#238636',
          subtle: '#12261e', // 背景用
        },
        warning: {
          DEFAULT: '#d29922',
          muted: '#9e6a03',
          subtle: '#2e2111', // 背景用
        },
        danger: {
          DEFAULT: '#f85149',
          muted: '#da3633',
          subtle: '#2d1619', // 背景用
        },
        // テスト実行中状態
        running: {
          DEFAULT: '#a371f7',
          subtle: '#271d3d',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.25rem' }],
        sm: ['0.8125rem', { lineHeight: '1.375rem' }],
        base: ['0.875rem', { lineHeight: '1.5rem' }],
        lg: ['1rem', { lineHeight: '1.75rem' }],
        xl: ['1.125rem', { lineHeight: '1.875rem' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        'card-hover': '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
