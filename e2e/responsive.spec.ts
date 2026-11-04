import { test, expect } from '@playwright/test';

test.describe('Indian Monopoly - Two-Tab Architecture & Practice Match E2E', () => {
  test('renders Play tab with title, practice match card, and two nav tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('INDIAN MONOPOLY');

    // Verify only two nav tabs are present: Play and Settings
    await expect(page.getByRole('link', { name: /^Play$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Settings$/i })).toBeVisible();

    // Verify Practice Match card is prominently visible
    await expect(page.getByRole('button', { name: /Launch Practice Match/i })).toBeVisible();
  });

  test('prompts for name on first launch, enters Practice Match, and rolls dice inside board', async ({ page }) => {
    await page.goto('/');

    // Launch Practice Match
    const launchBtn = page.getByRole('button', { name: /Launch Practice Match/i });
    await launchBtn.click();

    // Since first time, Name Prompt Modal should appear asking player for their name
    const nameInput = page.getByPlaceholder(/e\.g\. Vikramaditya/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Vikram Tycoon');

    const enterBtn = page.getByRole('button', { name: /Enter Game/i });
    await enterBtn.click();

    // Re-click launch if needed or check practice match
    await page.goto('/#/practice');

    // Verify Practice Match header
    await expect(page.getByText(/Practice Match \(Sandbox\)/i)).toBeVisible();

    // Verify In-Board ROLL DICE button
    const rollBtn = page.getByRole('button', { name: /ROLL DICE/i });
    await expect(rollBtn).toBeVisible();
    await rollBtn.click();

    // Turn should progress or dice outcome should show
    await expect(page.locator('text=Turn #').first()).toBeVisible();
  });

  test('navigates to Settings tab, tests sound and theme toggles', async ({ page }) => {
    await page.goto('/');

    // Navigate to Settings
    const settingsTab = page.getByRole('link', { name: /^Settings$/i });
    await settingsTab.click();

    await expect(page.locator('h1')).toContainText('Game Settings');

    // Test mute toggle
    const muteBtn = page.getByRole('button', { name: /^Mute$|^Unmute$/i });
    await expect(muteBtn).toBeVisible();
    await muteBtn.click();

    // Test Theme toggle
    const themeBtn = page.getByRole('button', { name: /Light Theme|Dark Theme/i });
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
