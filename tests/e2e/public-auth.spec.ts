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

  test('launches the restricted demo into the dashboard without normal sign-in', async ({ page }) => {
    await page.route('**/health', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ database: 'connected', databaseEngine: 'MariaDB' }) }));
    await page.route('**/api/auth/demo/status', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, mode: 'public', defaultRole: 'viewer', sessionTtlHours: 8 }),
    }));
    await page.route('**/api/auth/demo/login', route => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'e2e-demo-token',
        user: {
          uid: 'user-viewer', email: 'demo.viewer@ojix-public-demo.invalid',
          name: 'OJIX Demo Admin (Read only)', designation: 'Read-only Demo Admin',
          role: 'viewer', avatar: 'VM', description: 'Read-only synthetic demo',
          tenantId: '11111111-1111-4111-8111-111111111111', isSuperAdmin: false,
          isDemo: true, accessExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          permissions: ['dashboard.view', 'properties.view', 'documents.view', 'findings.view', 'legal.view', 'reports.view', 'maps.view'],
        },
      }),
    }));
    await page.route('**/api/auth/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: {
        uid: 'user-viewer', email: 'demo.viewer@ojix-public-demo.invalid',
        name: 'OJIX Demo Admin (Read only)', designation: 'Read-only Demo Admin',
        role: 'viewer', avatar: 'VM', description: 'Read-only synthetic demo',
        tenantId: '11111111-1111-4111-8111-111111111111', isSuperAdmin: false,
        isDemo: true, accessExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        permissions: ['dashboard.view', 'properties.view', 'documents.view', 'findings.view', 'legal.view', 'reports.view', 'maps.view'],
      } }),
    }));
    await page.route('**/api/auth/dummy-accounts', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/workspaces')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: '11111111-1111-4111-8111-111111111111', name: 'OJIX Public Demo', role: 'viewer', status: 'active' }] }) });
      if (url.pathname.includes('/api/auth/')) return route.fallback();
      if (url.pathname.endsWith('/workspaces')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: '11111111-1111-4111-8111-111111111111', name: 'OJIX Public Demo', role: 'viewer' }] }) });
      if (url.pathname.endsWith('/overview')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, documents: 0, findings: 0 }) });
      if (url.pathname.endsWith('/properties')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    });

    await page.goto('/login/viewer');
    const demoButton = page.getByRole('button', { name: /Launch Instant Demo Access \(Admin\)/ });
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    await expect(page).toHaveURL(/\/viewer\/dashboard$/);
    await expect(page.getByText('DEMO MODE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit Demo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Good morning, OJIX Demo Admin/ })).toBeVisible();
    await expect(page.getByPlaceholder('name@organisation.com')).toHaveCount(0);
  });
});
