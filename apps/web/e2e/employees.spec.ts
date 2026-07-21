import { expect, test } from '@playwright/test';
import { loginAsAdmin, TEST_ADMIN } from './helpers';

test.describe('Employee curriculum vitae', () => {
  test('creates a personal profile via API and shows detail page', async ({
    page,
    request,
  }) => {
    const suffix = String(Date.now()).slice(-8);
    const phone = `09${suffix}`;
    const email = `cv${suffix}@example.com`;
    const identity = `07912345${suffix.slice(-4)}`.padStart(12, '0').slice(-12);

    await loginAsAdmin(page);

    const login = await request.post('http://localhost:3000/api/auth/login', {
      data: {
        identifier: TEST_ADMIN.email,
        password: TEST_ADMIN.password,
      },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = await login.json();

    const created = await request.post('http://localhost:3000/api/employees', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        fullName: 'nguyen van e2e',
        gender: 'MALE',
        birthDate: '1998-01-01',
        birthPlace: 'TP Ho Chi Minh',
        placeOfOrigin: 'Hai Duong',
        permanentAddress: 'So 1, Quan 1, TP.HCM',
        currentAddress: 'So 2, Quan 3, TP.HCM',
        phone,
        email,
        ethnicity: 'Kinh',
        identityNumber: identity,
        identityIssuedDate: '2020-01-15',
        identityIssuedPlace: 'Cuc CSQLHC ve TTXH',
        educationLevel: 'GRADE_12',
      },
    });
    expect(created.ok()).toBeTruthy();
    const profile = await created.json();

    await page.goto(`/hr/employees/${profile.id}`);
    await expect(
      page.getByRole('heading', { name: `${profile.profileCode} · NGUYEN VAN E2E` }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText('I. Thông tin bản thân')).toBeVisible();
    await expect(page.getByText('II. Quan hệ gia đình')).toBeVisible();
    await expect(page.getByText('III. Tóm tắt quá trình đào tạo')).toBeVisible();
    await expect(page.getByText('IV. Tóm tắt quá trình công tác')).toBeVisible();

    await page.goto('/hr/employees/new');
    await expect(page.getByText('Khai báo sơ yếu lý lịch')).toBeVisible();
    await expect(page.getByText('I. Thông tin bản thân')).toBeVisible();
  });
});
