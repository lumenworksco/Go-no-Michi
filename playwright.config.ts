import { defineConfig, devices } from '@playwright/test';

// PORT: ローカルの vite preview を見るか、BASE_URL で本番サイトをそのまま見るか。
// 例: npm run e2e            → http://127.0.0.1:4173 を見る（webServer が自動で起動）
//     BASE_URL=https://go.braunf.com/ npm run e2e -- --project=chromium-desktop
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  // BASE_URL を指定したとき（本番サイトなど）は、自前サーバーを起動しない。
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4173 --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
});
