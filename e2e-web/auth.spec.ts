/**
 * Playwright E2E Test: Minimal smoke test
 * 
 * Just prove Playwright works - load the page
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('App loads and shows login button', async ({ page }) => {
    console.log('🚀 Starting test...');
    
    // Navigate to app
    await page.goto('/');
    console.log('✅ Page loaded');
    
    // Should see login screen
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 30000 });
    console.log('✅ Found "Continue with Google" button');
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/screenshot.png' });
    console.log('✅ Screenshot saved');
    
    console.log('🎉 Test passed!');
  });
});

