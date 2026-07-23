import { expect, test } from '@playwright/test';
import { getAdminAccessToken } from './helpers';
import { getE2eApiBase } from './api-base';

test.describe('Employee curriculum vitae', () => {
  test('creates draft via dialog and shows edit form with guide panel', async ({
    page,
    request,
  }) => {
    const suffix = String(Date.now()).slice(-8);
    const phone = `09${suffix}`;

    await page.goto('/hr/employees');
    await page.getByRole('button', { name: 'Thêm hồ sơ mới' }).click();
    await page.getByLabel('Họ và tên').fill('nguyen van e2e');
    await page.getByLabel('Số điện thoại').fill(phone);
    await page.getByLabel('Công ty chủ quản').click();
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .first()
      .click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    await expect(page).toHaveURL(/\/hr\/employees\/.+\/edit/);
    await expect(page.getByText('Hướng dẫn nhập liệu')).toBeVisible();
    await expect(page.getByLabel('Họ và tên')).toHaveValue('NGUYEN VAN E2E');
    await expect(page.getByLabel('Điện thoại')).toHaveValue(phone);

    // Focus email -> hướng dẫn bên phải đổi theo trường.
    await page.getByLabel('Email').click();
    await expect(page.getByRole('heading', { name: 'Email' })).toBeVisible();

    await page.goto('/hr/employees');
    await expect(page.getByRole('button', { name: 'Xuất hồ sơ' })).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Công ty chủ quản' })).toBeVisible();

    // Trùng SĐT → đi vào chi tiết hồ sơ đã có.
    await page.getByRole('button', { name: 'Thêm hồ sơ mới' }).click();
    await page.getByLabel('Họ và tên').fill('khac ten');
    await page.getByLabel('Số điện thoại').fill(phone);
    await page.getByLabel('Công ty chủ quản').click();
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .first()
      .click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page).toHaveURL(/\/hr\/employees\/[^/]+$/);
    await expect(page.getByRole('tab', { name: 'Thông tin cá nhân' })).toBeVisible();

    // Cleanup via API
    const accessToken = await getAdminAccessToken(request);
    const list = await request.get(
      `${getE2eApiBase()}/employees?search=${phone}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const body = await list.json();
    const id = body.items?.[0]?.id;
    if (id) {
      await request.delete(`${getE2eApiBase()}/employees/${id}/hard`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  });
});
