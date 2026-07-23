import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { createTestApp, getHttpServer, loginAsAdmin, TEST_ADMIN } from './test-utils';

describe('Permission Groups (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAsAdmin(app);

    const perms = await request(getHttpServer(app))
      .get('/api/permissions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const allIds: string[] = (perms.body.items ?? []).map((p: { id: string }) => p.id);
    const setupView = (perms.body.items ?? []).find(
      (p: { code: string }) => p.code === Permissions.SETUP_VIEW,
    );

    const existing = await request(getHttpServer(app))
      .get('/api/permission-groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (!existing.body.find((g: { code: string }) => g.code === 'full_access')) {
      await request(getHttpServer(app))
        .post('/api/permission-groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'full_access',
          name: 'Quản trị đầy đủ',
          permissionIds: allIds,
        })
        .expect(201);
    }
    if (!existing.body.find((g: { code: string }) => g.code === 'basic_user')) {
      await request(getHttpServer(app))
        .post('/api/permission-groups')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'basic_user',
          name: 'Người dùng cơ bản',
          permissionIds: setupView ? [setupView.id] : [],
        })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/permission-groups returns groups', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/permission-groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const fullAccess = res.body.find((g: { code: string }) => g.code === 'full_access');
    expect(fullAccess).toBeDefined();
    expect(fullAccess.versions.length).toBeGreaterThanOrEqual(1);
    expect(typeof fullAccess.positionCount).toBe('number');
  });

  it('GET /api/permission-groups/:id returns group detail', async () => {
    const list = await request(getHttpServer(app))
      .get('/api/permission-groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const groupId = list.body[0].id;
    const res = await request(getHttpServer(app))
      .get(`/api/permission-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(groupId);
    expect(Array.isArray(res.body.permissionIds)).toBe(true);
  });

  it('GET /api/users includes account fields without permission group', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    const admin = res.body.items.find(
      (u: { email: string }) => u.email === TEST_ADMIN.email,
    );
    expect(admin.accountCode).toMatch(/^TK-\d{5}$/);
    expect(admin.phone).toBe(TEST_ADMIN.phone);
    expect(admin.permissionGroupName).toBeUndefined();
    expect(admin.isSuperAdmin).toBe(true);
    expect(admin.roles).toBeUndefined();
  });

  it('rejects demoting or deactivating Super Admin', async () => {
    const users = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const admin = users.body.items.find(
      (u: { email: string }) => u.email === TEST_ADMIN.email,
    );

    await request(getHttpServer(app))
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(400);

    await request(getHttpServer(app))
      .delete(`/api/users/${admin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('GET /api/roles is no longer available', async () => {
    await request(getHttpServer(app))
      .get('/api/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /api/users/:id/permissions returns effective permissions from positions/admin', async () => {
    const users = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const admin = users.body.items.find(
      (u: { email: string }) => u.email === TEST_ADMIN.email,
    );

    const res = await request(getHttpServer(app))
      .get(`/api/users/${admin.id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.isSystemAdmin).toBe(true);
    expect(Array.isArray(res.body.effectivePermissionCodes)).toBe(true);
    expect(res.body.effectivePermissionCodes.length).toBeGreaterThan(0);
    expect(res.body.permissions).toBeDefined();
    expect(String(res.body.note)).toMatch(/Super Admin/i);
  });

  it('PATCH organization positionPermission assigns group to org representative', async () => {
    const groups = await request(getHttpServer(app))
      .get('/api/permission-groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const basic = groups.body.find((g: { code: string }) => g.code === 'basic_user');
    const version0 = basic.versions.find((v: { versionNumber: number }) => v.versionNumber === 0);

    const org = await request(getHttpServer(app))
      .get('/api/organization')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updated = await request(getHttpServer(app))
      .patch('/api/organization')
      .set('Authorization', `Bearer ${token}`)
      .send({
        positionPermission: {
          permissionGroupVersionId: version0.id,
          includeSelf: true,
          parentScopes: [],
        },
      })
      .expect(200);

    expect(updated.body.positionPermission).toBeTruthy();
    expect(updated.body.positionPermission.permissionGroupVersionId).toBe(version0.id);
    expect(updated.body.positionPermission.includeSelf).toBe(true);
    expect(org.body.id).toBe(updated.body.id);
  });
});
