import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error('INPUT environment variable is not set');
}

const isDevelopment = process.env.NODE_ENV === 'development';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    // 開発時はソースマップを有効化
    sourcemap: isDevelopment ? 'inline' : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
    },
    // distディレクトリに出力
    outDir: 'dist',
    emptyOutDir: false,
  },
});
