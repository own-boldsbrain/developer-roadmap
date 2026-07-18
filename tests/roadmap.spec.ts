import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const roadmapIds = fs.readdirSync(
  path.join(process.cwd(), 'src/data/roadmaps'),
);

test(`roadmaps @visual`, async ({ page }) => {
  await page.goto('/roadmaps');

  await expect(page).toHaveScreenshot({ fullPage: true });
});

for (const roadmapId of roadmapIds) {
  test(`roadmap ${roadmapId} @visual`, async ({ page }) => {
    await page.goto(`/${roadmapId}`);

    await expect(page).toHaveScreenshot({ fullPage: true });
  });
}
