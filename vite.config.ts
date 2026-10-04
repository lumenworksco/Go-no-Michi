import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// 公開版（build）の index.html にだけ Content-Security-Policy を入れる。GitHub Pages は HTTP ヘッダーを
// 付けられないので meta で指定する。dev サーバーは、React の更新用に inline スクリプトを使うので対象外。
// style の 'unsafe-inline' は、React が碁盤などに付ける style 属性のため。
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
const cspPlugin = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// GitHub Pages のプロジェクトサイトは /リポジトリ名/ 以下で公開されるため、ビルド時に BASE_PATH で指定する。
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt', // 更新は src/pwa.ts がホームで知らせ、押されたときだけ入れかえる
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ごのみち',
        short_name: 'ごのみち',
        description: 'しずかに うつ、いご。コンピュータと たいせん、ふたりで たいせん、つめご。',
        id: '/',
        lang: 'ja',
        categories: ['games', 'education'],
        display: 'standalone',
        background_color: '#0b0c0e',
        theme_color: '#0b0c0e',
        screenshots: [
          { src: 'screenshots/mobile-game.jpg', sizes: '824x1678', type: 'image/jpeg', form_factor: 'narrow', label: 'たいきょくの がめん' },
          { src: 'screenshots/mobile-home.jpg', sizes: '824x1678', type: 'image/jpeg', form_factor: 'narrow', label: 'ホームの がめん' },
          { src: 'screenshots/desktop-game.jpg', sizes: '1400x900', type: 'image/jpeg', form_factor: 'wide', label: 'パソコンの たいきょくの がめん' },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        // SNS カード用の画像・ストア用のスクリーンショット・404 ページはアプリ自体では使わないので、オフラインキャッシュに含めない。
        globIgnores: ['**/og-image.png', '**/screenshots/**', '**/404.html'],
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
