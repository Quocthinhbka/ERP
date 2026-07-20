import request from 'supertest';

import { INestApplication } from '@nestjs/common';

import { EntityStatus, OrgNodeType } from '@erp/shared';

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



    expect(res.body.name).toBeDefined();

    expect(res.body.members).toBeInstanceOf(Array);

  });



  it('PATCH /api/organization updates organization fields', async () => {

    const res = await request(getHttpServer(app))

      .patch('/api/organization')

      .set('Authorization', `Bearer ${accessToken}`)

      .send({

        representativeName: 'Đại diện Test',

        additionalInfo: 'Thông tin thêm test',

        members: [

          {

            position: 'Giám đốc',

            memberName: 'Nguyễn Văn A',

            phone: '0900000001',

            email: 'a@test.vn',

          },

        ],

      })

      .expect(200);



    expect(res.body.representativeName).toBe('Đại diện Test');

    expect(res.body.members).toHaveLength(1);

    expect(res.body.members[0].memberName).toBe('Nguyễn Văn A');

  });



  it('POST /api/organization/companies creates company', async () => {

    const res = await request(getHttpServer(app))

      .post('/api/organization/companies')

      .set('Authorization', `Bearer ${accessToken}`)

      .send({

        name: 'Công ty Test E2E',

        taxId: '0123456789',

        address: '123 Test Street',

        representativeName: 'Trần Văn B',

        phone: '0900000002',

        email: 'company@test.vn',

        status: EntityStatus.ACTIVE,

      })

      .expect(201);



    expect(res.body.name).toBe('Công ty Test E2E');

    companyId = res.body.id;

  });



  it('PATCH /api/organization/companies/:id/reorder reorders companies', async () => {

    const sibling = await request(getHttpServer(app))

      .post('/api/organization/companies')

      .set('Authorization', `Bearer ${accessToken}`)

      .send({ name: 'Công ty Test E2E 2', status: EntityStatus.ACTIVE })

      .expect(201);



    const treeBefore = await request(getHttpServer(app))

      .get('/api/organization/tree')

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(200);



    const indexBefore = treeBefore.body.tree.children.findIndex(

      (c: { id: string }) => c.id === sibling.body.id,

    );

    expect(indexBefore).toBeGreaterThan(0);

    const idAbove = treeBefore.body.tree.children[indexBefore - 1].id;



    await request(getHttpServer(app))

      .patch(`/api/organization/companies/${sibling.body.id}/reorder`)

      .set('Authorization', `Bearer ${accessToken}`)

      .send({ direction: 'up' })

      .expect(200);



    const treeAfter = await request(getHttpServer(app))

      .get('/api/organization/tree')

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(200);



    expect(treeAfter.body.tree.children[indexBefore - 1].id).toBe(sibling.body.id);

    expect(treeAfter.body.tree.children[indexBefore].id).toBe(idAbove);



    await request(getHttpServer(app))

      .delete(`/api/organization/companies/${sibling.body.id}`)

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(200);

  });



  it('POST /api/organization/units creates nested units', async () => {

    const parent = await request(getHttpServer(app))

      .post('/api/organization/units')

      .set('Authorization', `Bearer ${accessToken}`)

      .send({ companyId, name: 'Phòng Test', managerName: 'Manager A' })

      .expect(201);



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



  it('PATCH /api/organization/units/:id/reorder reorders sibling units', async () => {

    const sibling = await request(getHttpServer(app))

      .post('/api/organization/units')

      .set('Authorization', `Bearer ${accessToken}`)

      .send({ companyId, name: 'Phòng Test 2' })

      .expect(201);



    await request(getHttpServer(app))

      .patch(`/api/organization/units/${sibling.body.id}/reorder`)

      .set('Authorization', `Bearer ${accessToken}`)

      .send({ direction: 'up' })

      .expect(200);



    const tree = await request(getHttpServer(app))

      .get('/api/organization/tree')

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(200);



    const company = tree.body.tree.children.find((c: { id: string }) => c.id === companyId);

    expect(company.children[0].id).toBe(sibling.body.id);



    await request(getHttpServer(app))

      .delete(`/api/organization/units/${sibling.body.id}`)

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(200);

  });



  it('PATCH /api/organization/units/:id adds employees to leaf unit', async () => {

    const res = await request(getHttpServer(app))

      .patch(`/api/organization/units/${leafUnitId}`)

      .set('Authorization', `Bearer ${accessToken}`)

      .send({

        members: [

          {

            position: 'Nhân viên',

            memberName: 'Lê Văn C',

            phone: '0900000003',

            email: 'c@test.vn',

          },

        ],

      })

      .expect(200);



    expect(res.body.members).toHaveLength(1);

    expect(res.body.members[0].memberName).toBe('Lê Văn C');

  });



  it('blocks deleting unit with employees', async () => {

    await request(getHttpServer(app))

      .delete(`/api/organization/units/${leafUnitId}`)

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(400);

  });



  it('allows deleting leaf unit after removing employees', async () => {

    await request(getHttpServer(app))

      .patch(`/api/organization/units/${leafUnitId}`)

      .set('Authorization', `Bearer ${accessToken}`)

      .send({ members: [] })

      .expect(200);



    await request(getHttpServer(app))

      .delete(`/api/organization/units/${leafUnitId}`)

      .set('Authorization', `Bearer ${accessToken}`)

      .expect(200);

    leafUnitId = '';

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


