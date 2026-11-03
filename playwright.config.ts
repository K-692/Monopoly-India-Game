import { defineConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Desktop 1920x1080',
      use: { viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'Laptop 1366x768',
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'Tablet Landscape 1024x768',
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'iPad Portrait 820x1180',
      use: { viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'Small Tablet 768x1024',
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'Large Phone 430x932',
      use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'Modern Phone 390x844',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'Standard iPhone 375x667',
      use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'Small Phone 320x568',
      use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
