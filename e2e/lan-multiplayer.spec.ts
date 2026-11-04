/**
 * Indian Monopoly - Two-Browser LAN Multiplayer E2E Test
 * Simulates two separate physical devices on the same local network:
 * Host creates room -> Friend opens invite link -> Both ready up -> Host starts match ->
 * Real-time board state and actions synchronize seamlessly across both browsers without page refresh.
 */

import { test, expect } from '@playwright/test';

test.describe('Indian Monopoly - Two-Device LAN Multiplayer E2E', () => {
  test('Two separate browser contexts create, join via link, ready up, and start match', async ({ browser }) => {
    // 1. Device 1 (Host Laptop)
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    hostPage.on('console', (msg) => console.log('HOST:', msg.text()));

    await hostPage.addInitScript(() => {
      localStorage.setItem('monopoly_player_name', 'Maharaja Host');
      localStorage.setItem('monopoly_player_uid', 'host_device_1');
    });

    await hostPage.goto('/');

    // Host clicks Customize Rules & Host
    const hostBtn = hostPage.getByRole('button', { name: /Customize Rules & Host/i });
    await expect(hostBtn).toBeVisible();
    await hostBtn.click();

    // Host creates room with rules
    const createBtn = hostPage.getByRole('button', { name: /Create Room with Rules/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click({ force: true });

    // Host enters lobby and extracts 6-char room code
    await expect(hostPage.getByText(/Share Room Link \/ Code/i)).toBeVisible({ timeout: 15000 });
    const codeElem = hostPage.locator('.select-all');
    await expect(codeElem).toBeVisible();
    const inviteCode = (await codeElem.innerText()).trim();
    expect(inviteCode.length).toBe(6);

    // 2. Device 2 (Friend's Phone / Laptop)
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    guestPage.on('console', (msg) => console.log('GUEST:', msg.text()));

    await guestPage.addInitScript(() => {
      localStorage.setItem('monopoly_player_name', 'Tycoon Friend');
      localStorage.setItem('monopoly_player_uid', 'guest_device_2');
    });

    // Friend navigates to the shareable LAN invitation link
    await guestPage.goto(`/#/join/${inviteCode}`);

    // Friend should automatically join and land in the lobby
    await expect(guestPage.getByText(/Joined Players/i)).toBeVisible({ timeout: 15000 });
    await expect(guestPage.getByRole('main').getByText('Maharaja Host')).toBeVisible();
    await expect(guestPage.getByRole('main').getByText('Tycoon Friend')).toBeVisible();

    // Host should also observe Friend joined in real-time without refreshing
    await expect(hostPage.getByRole('main').getByText('Tycoon Friend')).toBeVisible();

    // Friend clicks Ready Up
    const readyBtn = guestPage.getByRole('button', { name: /Ready Up/i });
    await expect(readyBtn).toBeVisible();
    await readyBtn.click();

    // Verify Ready badge visible on both screens
    await expect(guestPage.getByText(/Ready/i).nth(1)).toBeVisible();
    await expect(hostPage.getByText(/Ready/i).nth(1)).toBeVisible();

    // Host starts match
    const startBtn = hostPage.getByRole('button', { name: /Start Game/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Both players should automatically transition to the live game board
    await expect(hostPage.locator('text=Turn #').first()).toBeVisible({ timeout: 15000 });
    await expect(guestPage.locator('text=Turn #').first()).toBeVisible({ timeout: 15000 });

    // Host rolls dice
    const rollBtn = hostPage.getByRole('button', { name: /ROLL DICE/i });
    await expect(rollBtn).toBeVisible();
    await rollBtn.click();

    // Both players observe dice outcome
    await expect(hostPage.getByText(/rolled/i).first()).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByText(/rolled/i).first()).toBeVisible({ timeout: 10000 });

    await hostContext.close();
    await guestContext.close();
  });
});
