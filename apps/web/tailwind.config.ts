import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Terminal/CLI風のカラーパレット
        background: {
          DEFAULT: '#0d1117',
          secondary: '#161b22',
          tertiary: '#21262d',
        },
        foreground: {
          DEFAULT: '#c9d1d9',
          muted: '#8b949e',
          subtle: '#6e7681',
        },
        border: {
          DEFAULT: '#30363d',
          muted: '#21262d',
        },
        accent: {
          DEFAULT: '#58a6ff',
          hover: '#79c0ff',
          muted: '#388bfd',
        },
        success: {
          DEFAULT: '#3fb950',
          muted: '#238636',
        },
        warning: {
          DEFAULT: '#d29922',
          muted: '#9e6a03',
        },
        danger: {
          DEFAULT: '#f85149',
          muted: '#da3633',
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
