import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { createTestApp, getHttpServer } from './test-utils';

describe('Setup / Permissions (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let roleId: string;
  let permissionIds: string[];
  let createdUserId: string;
  let createdRoleId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const login = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ email: 'admin@hyperlabs.vn', password: 'Admin@123' });

    accessToken = login.body.accessToken;

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
    const email = `test_${Date.now()}@hyperlabs.vn`;
    const res = await request(getHttpServer(app))
      .post('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        password: 'Test@1234',
        fullName: 'Test User',
        roleIds: [roleId],
      })
      .expect(201);

    expect(res.body.email).toBe(email);
    createdUserId = res.body.id;
  });

  it('POST /api/queue/demo enqueues job', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/queue/demo')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'E2E test job' })
      .expect(201);

    expect(res.body.jobId).toBeDefined();
    expect(res.body.status).toBe('queued');
  });
});
