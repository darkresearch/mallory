// Playwright E2E Tests Configuration
// Web browser testing for Mallory

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-web',
  
  // Simpler settings for local testing
  fullyParallel: false,
  retries: 0,
  workers: 1,
  
  // Reporter to use
  reporter: 'list',
  
  // Shared settings
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Just test Chrome
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NOTE: Start the web app manually before running tests
  // Terminal 1: cd apps/client && bun run web
  // Terminal 2: bunx playwright test
});

