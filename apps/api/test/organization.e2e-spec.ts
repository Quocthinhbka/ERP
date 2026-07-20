import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { OrgNodeType } from '@erp/shared';
import { createTestApp, getHttpServer } from './test-utils';

describe('Organization (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let companyId: string;
  let parentUnitId: string;
  let childUnitId: string;
  let leafUnitId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const login = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ email: 'admin@hyperlabs.vn', password: 'Admin@123' });
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (leafUnitId) {
      await request(getHttpServer(app))
        .delete(`/api/organization/units/${leafUnitId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    if (childUnitId) {
      await request(getHttpServer(app))
        .delete(`/api/organization/units/${childUnitId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    if (parentUnitId) {
      await request(getHttpServer(app))
        .delete(`/api/organization/units/${parentUnitId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    if (companyId) {
      await request(getHttpServer(app))
        .delete(`/api/organization/companies/${companyId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    await app.close();
  });

  it('GET /api/organization returns singleton organization', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/organization')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.code).toBe('ORG');
    expect(res.body.name).toBeDefined();
  });

  it('POST /api/organization/companies creates company with auto code', async () => {
    const res = await request(getHttpServer(app))
      .post('/api/organization/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Công ty Test E2E' })
      .expect(201);

    expect(res.body.code).toMatch(/^C\d{2}$/);
    companyId = res.body.id;
  });

  it('POST /api/organization/units creates units with auto code', async () => {
    const parent = await request(getHttpServer(app))
      .post('/api/organization/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId, name: 'Phòng Test' })
      .expect(201);

    expect(parent.body.code).toMatch(/^C\d{2}-\d{3}$/);
    parentUnitId = parent.body.id;

    const child = await request(getHttpServer(app))
      .post('/api/organization/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId, parentUnitId, name: 'Team Test' })
      .expect(201);

    childUnitId = child.body.id;

    const leaf = await request(getHttpServer(app))
      .post('/api/organization/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId, parentUnitId: childUnitId, name: 'Nhóm Test' })
      .expect(201);

    leafUnitId = leaf.body.id;
  });

  it('GET /api/organization/tree returns nested tree', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/organization/tree')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.tree.type).toBe(OrgNodeType.ORGANIZATION);
    expect(res.body.tree.children.some((c: { id: string }) => c.id === companyId)).toBe(true);
  });

  it('blocks deleting parent unit with children', async () => {
    await request(getHttpServer(app))
      .delete(`/api/organization/units/${parentUnitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('allows deleting leaf unit', async () => {
    await request(getHttpServer(app))
      .delete(`/api/organization/units/${leafUnitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    leafUnitId = '';
  });

  it('PATCH /api/organization/units/:id/move moves unit', async () => {
    await request(getHttpServer(app))
      .patch(`/api/organization/units/${childUnitId}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ parentUnitId: null })
      .expect(200);
  });

  it('GET /api/organization/tree?search= filters tree', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/organization/tree')
      .query({ search: 'Team Test' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.matchedKeys.length).toBeGreaterThan(0);
  });
});
