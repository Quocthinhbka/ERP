import { test, expect } from '@playwright/test';
import { loginAsAdmin, TEST_ADMIN } from './helpers';

test.describe('Organization page', () => {
  test('shows organization tree page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await expect(page.getByText('Thiết lập / Tổ chức')).toBeVisible();
    await expect(page.getByRole('tree')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('treeitem').first()).toBeVisible();
  });

  test('organization node can be edited', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await page.getByRole('treeitem').first().click();
    await expect(page.locator('button[title="Sửa"]')).toBeVisible();
    await page.locator('button[title="Sửa"]').click();
    await expect(page.getByRole('button', { name: 'Lưu' })).toBeVisible();
    await expect(page.getByLabel('Tên tổ chức')).toBeVisible();
  });

  test('company detail panel is read-only until edit is clicked', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await page.getByRole('treeitem').first().click();
    page.once('dialog', (dialog) => dialog.accept('Công ty Playwright Test'));
    await page.getByRole('button', { name: 'Thêm công ty' }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'Công ty Playwright Test' }).first()).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('treeitem').filter({ hasText: 'Công ty Playwright Test' }).first().click();
    await expect(page.locator('button[title="Sửa"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu' })).toHaveCount(0);
    await page.locator('button[title="Sửa"]').click();
    await expect(page.getByRole('button', { name: 'Lưu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hủy' })).toBeVisible();
  });

  test('shows import export buttons', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Excel' })).toBeVisible();
  });

  test('leaf unit employees appear on tree as position - name', async ({ page, request }) => {
    test.setTimeout(60000);
    const apiBase = 'http://127.0.0.1:3000/api';
    const login = await request.post(`${apiBase}/auth/login`, {
      data: { identifier: TEST_ADMIN.email, password: TEST_ADMIN.password },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken: string };
    const headers = { Authorization: `Bearer ${accessToken}` };

    const companyName = `Công ty Leaf Emp ${Date.now()}`;
    const unitName = `Đơn vị lá Emp ${Date.now()}`;
    const companyRes = await request.post(`${apiBase}/organization/companies`, {
      headers,
      data: { name: companyName },
    });
    expect(companyRes.ok()).toBeTruthy();
    const company = (await companyRes.json()) as { id: string };

    const unitRes = await request.post(`${apiBase}/organization/units`, {
      headers,
      data: { companyId: company.id, name: unitName },
    });
    expect(unitRes.ok()).toBeTruthy();
    const unit = (await unitRes.json()) as { id: string };

    const memberRes = await request.patch(`${apiBase}/organization/units/${unit.id}`, {
      headers,
      data: {
        members: [{ position: 'Nhân viên', memberName: 'Nguyễn Văn A' }],
      },
    });
    expect(memberRes.ok()).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await expect(page.getByRole('tree')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Mở rộng' }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: unitName }).first()).toBeVisible({
      timeout: 10000,
    });
    const memberRow = page.getByRole('treeitem').filter({ hasText: 'Nhân viên - Nguyễn Văn A' }).first();
    await expect(memberRow).toBeVisible({ timeout: 10000 });
    await memberRow.click();
    await expect(page.getByText('Chi tiết chức vụ')).toBeVisible();
    await expect(page.getByText('Nguyễn Văn A').first()).toBeVisible();
    await expect(page.getByText('Nhân viên').first()).toBeVisible();
  });
});
