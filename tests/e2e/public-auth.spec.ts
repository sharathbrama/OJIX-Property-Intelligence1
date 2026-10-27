import { expect, test } from '@playwright/test';

test.describe('public authentication experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the OJIX login landing experience', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Property intelligence/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register', exact: true })).toBeVisible();
  });

  test('opens the secure login form and exposes required controls', async ({ page }) => {
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByPlaceholder('name@organisation.com')).toBeVisible();
    await expect(page.getByLabel('Show password')).toBeVisible();
  });

  test('shows the API/database outage without hiding the login form', async ({ page }) => {
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByText('API or database unavailable. Start the local stack and retry.')).toBeVisible();
    await expect(page.getByPlaceholder('name@organisation.com')).toBeVisible();
  });

  test('toggles password visibility', async ({ page }) => {
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    const password = page.locator('input[autocomplete="current-password"]');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByLabel('Show password').click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByLabel('Hide password')).toBeVisible();
  });

  test('navigates to registration and shows required account fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByText('FULL NAME', { exact: true })).toBeVisible();
    await expect(page.getByText('WORK EMAIL', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register and Send OTP' })).toBeVisible();
  });

  test('has no horizontal page overflow at the configured viewport', async ({ page }) => {
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
