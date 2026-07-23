import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  ensureTestManagingCompany,
  getHttpServer,
  loginAsAdmin,
} from './test-utils';

describe('Personal module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let employeeId: string;
  let userId: string;
  let editRequestId: string;
  const suffix = String(Date.now()).slice(-8);
  const phone = `06${suffix}`;
  const email = `personal${suffix}@example.com`;
  const firstPassword = phone.slice(-8);
  const password = `Personal-${suffix}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    adminToken = await loginAsAdmin(app);
    const company = await ensureTestManagingCompany(app, adminToken);

    const employee = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'nhân viên cá nhân',
        phone,
        email,
        managingCompanyId: company.id,
      })
      .expect(201);
    employeeId = employee.body.id;
    await prisma.employeeProfile.update({
      where: { id: employeeId },
      data: { status: 'VERIFIED' },
    });

    const account = await request(getHttpServer(app))
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeProfileId: employeeId })
      .expect(201);
    userId = account.body.id;

    const login = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ identifier: phone, password: firstPassword })
      .expect(200);
    const changed = await request(getHttpServer(app))
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ newPassword: password })
      .expect(200);
    userToken = changed.body.accessToken;
  });

  afterAll(async () => {
    // Xoá hồ sơ trước để cascade các edit-request (requested_by dùng RESTRICT),
    // đồng thời gỡ liên kết tài khoản, rồi mới xoá user.
    if (employeeId) {
      await prisma.employeeProfile.deleteMany({ where: { id: employeeId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('returns the current account and linked profile without HR permission', async () => {
    const account = await request(getHttpServer(app))
      .get('/api/personal/account')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(account.body.id).toBe(userId);
    expect(account.body.linkedEmployeeProfileId).toBe(employeeId);

    const profile = await request(getHttpServer(app))
      .get('/api/personal/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(profile.body.id).toBe(employeeId);

    await request(getHttpServer(app))
      .get(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('requires an edit request for VERIFIED and lets HR approve it', async () => {
    await request(getHttpServer(app))
      .patch('/api/personal/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ strengths: 'Không được sửa lúc đã xác thực' })
      .expect(400);

    const created = await request(getHttpServer(app))
      .post('/api/personal/profile/edit-requests')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Cần cập nhật thông tin cá nhân' })
      .expect(201);
    editRequestId = created.body.id;

    const afterRequest = await request(getHttpServer(app))
      .get('/api/personal/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(afterRequest.body.status).toBe('EDIT_REQUESTED');

    await request(getHttpServer(app))
      .post('/api/personal/profile/edit-requests')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Yêu cầu trùng lặp' })
      .expect(400);

    const listed = await request(getHttpServer(app))
      .get('/api/employees/edit-requests?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.some((item: { id: string }) => item.id === editRequestId)).toBe(
      true,
    );

    await request(getHttpServer(app))
      .post(`/api/employees/edit-requests/${editRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewNote: 'Đồng ý mở chỉnh sửa' })
      .expect(201);

    const opened = await request(getHttpServer(app))
      .get('/api/personal/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(opened.body.status).toBe('NEEDS_ADJUSTMENT');

    const updated = await request(getHttpServer(app))
      .patch('/api/personal/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ strengths: 'Đã cập nhật theo yêu cầu' })
      .expect(200);
    // Hồ sơ e2e chưa đủ field bắt buộc → auto về Chưa khai báo khi lưu.
    expect(updated.body.status).toBe('INCOMPLETE');
    expect(updated.body.strengths).toBe('Đã cập nhật theo yêu cầu');
  });

  it('requires the current password for a voluntary password change', async () => {
    await request(getHttpServer(app))
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ newPassword: `${password}-next` })
      .expect(400);
  });
});
