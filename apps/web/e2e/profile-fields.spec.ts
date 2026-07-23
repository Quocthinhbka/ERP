import { test, expect } from '@playwright/test';

test.describe('Profile field settings', () => {
  test('shows tabs and field library', async ({ page }) => {
    await page.goto('/setup/hr/profile-fields');
    await expect(page.getByTestId('profile-fields-settings-page')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /Thông tin cá nhân/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Thông tin hợp đồng/ })).toBeVisible();
    await expect(page.getByText('Thư viện trường')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm trường' })).toBeVisible();
  });
});
