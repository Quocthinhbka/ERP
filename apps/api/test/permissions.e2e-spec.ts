import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { createTestApp, ensureTestManagingCompany, getHttpServer, loginAsAdmin } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Setup / Permissions (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let prisma: PrismaService;
  let createdUserId: string;
  let createdEmployeeId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    accessToken = await loginAsAdmin(app);
  });

  afterAll(async () => {
    if (createdUserId) {
      await request(getHttpServer(app))
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    if (createdEmployeeId) {
      await prisma.employeeProfile.deleteMany({
        where: { id: createdEmployeeId },
      });
    }
    await app.close();
  });

  it('GET /api/roles is removed', async () => {
    await request(getHttpServer(app))
      .get('/api/roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('GET /api/permissions returns grouped permissions', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/permissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.grouped).toBeDefined();
    expect(
      res.body.items.some((p: { code: string }) => p.code.startsWith('role:')),
    ).toBe(false);
    expect(
      res.body.items.some((p: { code: string }) => p.code === Permissions.PERMISSION_VIEW),
    ).toBe(true);
  });

  it('GET /api/users returns paginated users', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items[0].roles).toBeUndefined();
  });

  it('POST /api/users creates user without account permission group', async () => {
    const company = await ensureTestManagingCompany(app, accessToken);
    const suffix = String(Date.now()).slice(-8);
    const email = `perm${suffix}@example.com`;
    const employee = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Test User',
        gender: 'MALE',
        birthDate: '1990-01-01',
        birthPlace: 'Ha Noi',
        placeOfOrigin: 'Ha Noi',
        permanentAddress: 'Dia chi thuong tru',
        currentAddress: 'Dia chi hien tai',
        phone: `06${suffix}`,
        email,
        ethnicity: 'Kinh',
        identityNumber: `01234567${suffix.slice(-4)}`.padStart(12, '0').slice(-12),
        identityIssuedDate: '2018-01-01',
        identityIssuedPlace: 'Cuc CSQLHC',
        educationLevel: 'UNIVERSITY',
        managingCompanyId: company.id,
      })
      .expect(201);
    createdEmployeeId = employee.body.id;

    await prisma.employeeProfile.update({
      where: { id: createdEmployeeId },
      data: { status: 'INCOMPLETE' },
    });

    const res = await request(getHttpServer(app))
      .post('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ employeeProfileId: createdEmployeeId })
      .expect(201);

    expect(res.body.email).toBe(email);
    expect(res.body.accountCode).toBe(
      employee.body.profileCode.replace('HS-', 'TK-'),
    );
    expect(res.body.isSuperAdmin).toBe(false);
    expect(res.body.permissionGroupId).toBeUndefined();
    expect(res.body.permissionGroup).toBeUndefined();
    expect(res.body.roles).toBeUndefined();
    createdUserId = res.body.id;

    const perms = await request(getHttpServer(app))
      .get(`/api/users/${createdUserId}/permissions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(perms.body.isSystemAdmin).toBe(false);
    expect(Array.isArray(perms.body.effectivePermissionCodes)).toBe(true);
    expect(perms.body.effectivePermissionCodes).toEqual([]);
    expect(String(perms.body.note)).toMatch(/vị trí trên cây tổ chức/i);
  });
});
