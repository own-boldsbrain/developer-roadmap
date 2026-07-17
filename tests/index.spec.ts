import { test, expect } from '@playwright/test';

test('homepage test @visual', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveScreenshot({ fullPage: true });
});
