import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { createTestApp, getHttpServer, loginAsAdmin } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Setup / Permissions (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let prisma: PrismaService;
  let roleId: string;
  let permissionIds: string[];
  let createdUserId: string;
  let createdEmployeeId: string;
  let createdRoleId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    accessToken = await loginAsAdmin(app);

    const roles = await request(getHttpServer(app))
      .get('/api/roles')
      .set('Authorization', `Bearer ${accessToken}`);

    roleId = roles.body.find((r: { code: string }) => r.code === 'user').id;

    const permissions = await request(getHttpServer(app))
      .get('/api/permissions')
      .set('Authorization', `Bearer ${accessToken}`);

    permissionIds = permissions.body.items
      .filter(
        (p: { code: string }) =>
          p.code === Permissions.SETUP_VIEW || p.code === Permissions.USER_VIEW,
      )
      .map((p: { id: string }) => p.id);
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
    if (createdRoleId) {
      await request(getHttpServer(app))
        .delete(`/api/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    await app.close();
  });

  it('GET /api/roles returns roles list', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body.some((r: { code: string }) => r.code === 'super_admin')).toBe(true);
  });

  it('GET /api/permissions returns grouped permissions', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/permissions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.grouped).toBeDefined();
  });

  it('POST /api/roles creates custom role', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: `test_role_${Date.now()}`,
        name: 'Test Role',
        description: 'E2E test role',
        permissionIds,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.permissions.length).toBe(permissionIds.length);
    createdRoleId = res.body.id;
  });

  it('GET /api/users returns paginated users', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('POST /api/users creates user', async () => {
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
      })
      .expect(201);
    createdEmployeeId = employee.body.id;

    const res = await request(getHttpServer(app))
      .post('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        employeeProfileId: createdEmployeeId,
        roleIds: [roleId],
      })
      .expect(201);

    expect(res.body.email).toBe(email);
    expect(res.body.accountCode).toBe(
      employee.body.profileCode.replace('HS-', 'TK-'),
    );
    createdUserId = res.body.id;
  });

});
