import { test, expect } from '@playwright/test';

test('home page loads and shows structure', async ({ page }) => {
  await page.goto('/');
  // Skip link presence supports accessibility
  await expect(
    page.getByRole('link', { name: 'Перейти к содержимому' })
  ).toBeVisible();
  // Greeting h3 should be visible
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
});
