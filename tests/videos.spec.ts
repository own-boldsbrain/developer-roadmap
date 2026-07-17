import { expect, test } from '@playwright/test';

test(`videos @visual`, async ({ page }) => {
  await page.goto('/videos');

  await expect(page).toHaveScreenshot({ fullPage: true });
});
