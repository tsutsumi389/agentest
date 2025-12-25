import type { Config } from 'tailwindcss';

/**
 * Tailwind設定
 * 管理画面用のダークテーマ
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 背景色
        background: {
          DEFAULT: '#0d1117',
          secondary: '#161b22',
          tertiary: '#21262d',
        },
        // 前景色（テキスト）
        foreground: {
          DEFAULT: '#c9d1d9',
          muted: '#8b949e',
          subtle: '#484f58',
        },
        // ボーダー
        border: {
          DEFAULT: '#30363d',
          muted: '#21262d',
        },
        // アクセントカラー（管理画面用 - 紫系）
        accent: {
          DEFAULT: '#a855f7',
          muted: '#a855f720',
          hover: '#9333ea',
        },
        // セマンティックカラー
        success: {
          DEFAULT: '#3fb950',
          muted: '#3fb95020',
        },
        warning: {
          DEFAULT: '#d29922',
          muted: '#d2992220',
        },
        danger: {
          DEFAULT: '#f85149',
          muted: '#f8514920',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
