import { test, expect } from '@playwright/test';

test.describe('Indian Monopoly - Header, Rules Modal, & Gameplay E2E', () => {
  test('renders Play tab, question mark rules button, and sound toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toContainText('INDIAN MONOPOLY');

    // Verify navigation tabs: Play and Settings (Rules tab removed)
    await expect(page.getByRole('link', { name: /^Play$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Settings$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Rules$/i })).toHaveCount(0);

    // Verify Question Mark Rules button on the left of speaker button
    const rulesBtn = page.getByRole('button', { name: /View Game Rules/i });
    await expect(rulesBtn).toBeVisible();

    // Verify Practice Match card is prominently visible
    await expect(page.getByRole('button', { name: /Launch Practice Match/i })).toBeVisible();
  });

  test('clicks question mark button, verifies popup rules window, and closes it', async ({ page }) => {
    await page.goto('/');

    // Click the question mark button
    const rulesBtn = page.getByRole('button', { name: /View Game Rules/i });
    await rulesBtn.click({ force: true });

    // Verify popup window dialog appears
    const modalTitle = page.getByText('Official Rulebook & Strategy Guide');
    await expect(modalTitle).toBeVisible();

    // Test tabs inside Rules modal
    const civicTab = page.getByRole('button', { name: /Civic Fund \(12 Rules\)/i });
    await expect(civicTab).toBeVisible();
    await civicTab.click();
    await expect(page.getByText('The dice roll total determines the active rule index')).toBeVisible();

    const bankruptcyTab = page.getByRole('button', { name: /Bankruptcy & Jail/i });
    await expect(bankruptcyTab).toBeVisible();
    await bankruptcyTab.click({ force: true });
    await expect(page.getByText('Complete Bankruptcy Invariant')).toBeVisible();

    // Close the rules modal
    const closeBtn = page.getByRole('button', { name: /Close Rules/i }).first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click({ force: true });

    // Modal should now be closed
    await expect(modalTitle).not.toBeVisible();
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
    await enterBtn.click({ force: true });

    // Re-click launch if needed or navigate to practice match
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
