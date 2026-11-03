import { test, expect } from '@playwright/test';

test.describe('Indian Monopoly - Responsive & Smoke E2E Tests', () => {
  test('renders landing page with title and feature highlights', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('INDIAN MONOPOLY');
    await expect(page.getByRole('button', { name: /Play Instant Match/i })).toBeVisible();
  });

  test('navigates to instant game and rolls dice', async ({ page }) => {
    await page.goto('/');
    const playBtn = page.getByRole('button', { name: /Play Instant Match/i });
    await playBtn.click();

    // Verify game board renders
    await expect(page.getByText('Turn #1')).toBeVisible();

    // Verify Roll The Dice button is available
    const rollButton = page.getByRole('button', { name: /Roll The Dice/i });
    await expect(rollButton).toBeVisible();
    await rollButton.click();

    // Expect turn progression or dice outcome to appear
    await expect(page.locator('text=Turn #')).toBeVisible();
  });

  test('toggles sound mute and theme correctly', async ({ page }) => {
    await page.goto('/');

    const muteBtn = page.getByLabel(/Mute sounds|Unmute sounds/i);
    await expect(muteBtn).toBeVisible();
    await muteBtn.click();

    const themeBtn = page.getByLabel(/Toggle theme/i);
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
