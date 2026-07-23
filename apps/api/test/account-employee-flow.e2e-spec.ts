import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  ensureTestManagingCompany,
  getHttpServer,
  loginAsAdmin,
} from './test-utils';

function personalPayload(suffix: string, managingCompanyId: string) {
  return {
    fullName: 'nhân viên tài khoản',
    gender: 'FEMALE',
    birthDate: '1995-05-20',
    birthPlace: 'Hà Nội',
    placeOfOrigin: 'Nam Định',
    permanentAddress: 'Địa chỉ thường trú',
    currentAddress: 'Địa chỉ hiện tại',
    phone: `08${suffix}`,
    email: `account${suffix}@example.com`,
    ethnicity: 'Kinh',
    identityNumber: `00123456${suffix.slice(-4)}`.padStart(12, '0').slice(-12),
    identityIssuedDate: '2019-08-01',
    identityIssuedPlace: 'Cục CSQLHC về TTXH',
    educationLevel: 'UNIVERSITY',
    managingCompanyId,
  };
}

describe('Account linked to employee profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeId: string;
  let userId: string;
  const suffix = String(Date.now()).slice(-8);
  const phone = `08${suffix}`;
  const email = `account${suffix}@example.com`;
  const defaultPassword = phone.slice(-8);
  const newPassword = `New-${defaultPassword}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    adminToken = await loginAsAdmin(app);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (employeeId) {
      await prisma.employeeProfile.deleteMany({ where: { id: employeeId } });
    }
    await app.close();
  });

  it('creates an account from a profile and enforces first-login password change', async () => {
    const company = await ensureTestManagingCompany(app, adminToken);
    const employeeResponse = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(personalPayload(suffix, company.id))
      .expect(201);
    employeeId = employeeResponse.body.id;

    // Hồ sơ bất kỳ (kể cả nháp) đều có thể tạo tài khoản liên kết.
    await prisma.employeeProfile.update({
      where: { id: employeeId },
      data: { status: 'INCOMPLETE' },
    });

    const accountResponse = await request(getHttpServer(app))
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeProfileId: employeeId })
      .expect(201);
    userId = accountResponse.body.id;

    expect(accountResponse.body.accountCode).toBe(
      employeeResponse.body.profileCode.replace('HS-', 'TK-'),
    );
    expect(accountResponse.body.email).toBe(email);
    expect(accountResponse.body.phone).toBe(phone);
    expect(accountResponse.body.mustChangePassword).toBe(true);

    const loginResponse = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: phone, password: defaultPassword })
      .expect(200);
    expect(loginResponse.body.user.mustChangePassword).toBe(true);

    await request(getHttpServer(app))
      .get(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      });

    // Lần đầu: không cần mật khẩu hiện tại.
    const changedResponse = await request(getHttpServer(app))
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({ newPassword })
      .expect(200);
    expect(changedResponse.body.user.mustChangePassword).toBe(false);

    // Tài khoản thường chưa gắn vị trí → không có quyền HR; hồ sơ cá nhân vẫn xem được.
    await request(getHttpServer(app))
      .get(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${changedResponse.body.accessToken}`)
      .expect(403);

    await request(getHttpServer(app))
      .get('/api/personal/profile')
      .set('Authorization', `Bearer ${changedResponse.body.accessToken}`)
      .expect(200);
  });

  it('synchronizes profile name, phone and email to the linked account', async () => {
    const updatedPhone = `07${String(Date.now()).slice(-8)}`;
    const updatedEmail = `synced${String(Date.now()).slice(-8)}@example.com`;
    await request(getHttpServer(app))
      .patch(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'tên đã đồng bộ',
        phone: updatedPhone,
        email: updatedEmail,
      })
      .expect(200);

    const linkedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(linkedUser.fullName).toBe('TÊN ĐÃ ĐỒNG BỘ');
    expect(linkedUser.phone).toBe(updatedPhone);
    expect(linkedUser.email).toBe(updatedEmail);
  });

  it('allows direct account contact update and syncs to linked profile', async () => {
    const nextEmail = `direct${String(Date.now()).slice(-8)}@example.com`;
    await request(getHttpServer(app))
      .patch(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: nextEmail })
      .expect(200);

    const profile = await prisma.employeeProfile.findUniqueOrThrow({
      where: { id: employeeId },
    });
    expect(profile.email).toBe(nextEmail);
  });
});
