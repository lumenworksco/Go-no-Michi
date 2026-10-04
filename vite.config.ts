import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のプロジェクトサイトは /リポジトリ名/ 以下で公開されるため、ビルド時に BASE_PATH で指定する。
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // 更新は src/pwa.ts がホームで知らせ、押されたときだけ入れかえる
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ごのみち',
        short_name: 'ごのみち',
        description: 'しずかに うつ、いご。コンピュータと たいせん、ふたりで たいせん、つめご。',
        lang: 'ja',
        display: 'standalone',
        background_color: '#0b0c0e',
        theme_color: '#0b0c0e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // SNS カード用の画像はアプリ自体では使わないので、オフラインキャッシュに含めない。
        globIgnores: ['**/og-image.png'],
      },
    }),
  ],
  worker: { format: 'es' },
  // e2e/ は Playwright（npm run e2e）が使う。vitest（npm test）はユニットテストだけを見る。
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    testTimeout: 30_000, // AI の自己対戦は、遅い CI やカバレッジ計測の中でも終わるように
    // npm run coverage：画面（ui/）は e2e で確かめるので、ここでは数えない
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts', 'src/testStorage.ts', 'src/ai/worker.ts', 'src/main.tsx', 'src/pwa.ts'] },
  },
});
