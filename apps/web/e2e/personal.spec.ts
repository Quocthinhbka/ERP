import { expect, test } from '@playwright/test';

test.describe('Module Cá nhân', () => {
  test('menu luôn hiển thị và trang tài khoản tải thông tin hiện tại', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Cá nhân', { exact: true }).click();
    await page.getByText('Tài khoản cá nhân', { exact: true }).click();
    await expect(page).toHaveURL(/\/personal\/account$/);
    await expect(page.getByText('Thông tin tài khoản')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Đổi mật khẩu' }),
    ).toBeVisible();
    await expect(page.getByLabel('Mật khẩu hiện tại')).toBeVisible();
  });

  test('hồ sơ đã xác thực cho phép gửi yêu cầu sửa', async ({ page }) => {
    await page.goto('/');
    let requested = false;
    await page.route('**/api/personal/profile', async (route) => {
      if (route.request().method() === 'POST') {
        requested = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'request-1', status: 'PENDING' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'profile-1',
          profileCode: 'HS-00001',
          fullName: 'NHÂN VIÊN CÁ NHÂN',
          phone: '0900000000',
          email: 'personal@example.com',
          gender: null,
          birthDate: null,
          birthPlace: null,
          placeOfOrigin: null,
          permanentAddress: null,
          currentAddress: null,
          ethnicity: null,
          religion: null,
          identityNumber: null,
          identityIssuedDate: null,
          identityIssuedPlace: null,
          educationLevel: null,
          status: 'VERIFIED',
          familyMembers: [],
          educationHistories: [],
          workHistories: [],
          latestEditRequest: requested
            ? {
                id: 'request-1',
                status: 'PENDING',
                reason: 'Cập nhật địa chỉ',
                createdAt: new Date().toISOString(),
              }
            : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });
    await page.route('**/api/personal/profile/edit-requests', async (route) => {
      requested = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'request-1', status: 'PENDING' }),
      });
    });

    await page.goto('/personal/profile');
    await page.getByRole('button', { name: 'Yêu cầu sửa' }).click();
    await page
      .getByPlaceholder('Nêu rõ nội dung cần chỉnh sửa')
      .fill('Cập nhật địa chỉ');
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(page.getByText('Yêu cầu sửa đang chờ HR xử lý')).toBeVisible();
  });
});
