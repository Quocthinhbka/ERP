import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { EmployeeProfileFieldDataType } from '@erp/shared';
import { createTestApp, getHttpServer, loginAsAdmin } from './test-utils';

describe('Employee profile settings layout (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    accessToken = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/employee-profile-settings returns tabs + fields', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/employee-profile-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.tabs)).toBe(true);
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.tabs.map((t: { code: string }) => t.code)).toEqual(
      expect.arrayContaining(['personal', 'contract']),
    );
    expect(
      res.body.fields.some(
        (f: { code: string }) => f.code === 'employmentStatus',
      ),
    ).toBe(true);
    expect(
      res.body.fields.some(
        (f: {
          code: string;
          required: boolean;
          storageKey: string | null;
          tabIds?: string[];
        }) =>
          f.code === 'managingCompanyId' &&
          f.required === true &&
          f.storageKey === 'managingCompanyId',
      ),
    ).toBe(true);

    const managingField = res.body.fields.find(
      (f: { code: string }) => f.code === 'managingCompanyId',
    );
    const personalTab = res.body.tabs.find(
      (t: { code: string }) => t.code === 'personal',
    );
    const contractTab = res.body.tabs.find(
      (t: { code: string }) => t.code === 'contract',
    );
    expect(personalTab).toBeTruthy();
    expect(contractTab).toBeTruthy();
    expect(managingField.tabIds).toEqual([contractTab.id]);
    expect(
      personalTab.fields.some(
        (f: { code: string }) => f.code === 'managingCompanyId',
      ),
    ).toBe(false);
    expect(
      contractTab.fields.some(
        (f: { code: string }) => f.code === 'managingCompanyId',
      ),
    ).toBe(true);
  });

  it('POST custom field then PATCH employee customValues', async () => {
    const layout = await request(getHttpServer(app))
      .get('/api/employee-profile-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const personalTab = layout.body.tabs.find(
      (t: { code: string }) => t.code === 'personal',
    );
    expect(personalTab).toBeTruthy();

    const created = await request(getHttpServer(app))
      .post('/api/employee-profile-settings/fields')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        label: `E2E Custom ${Date.now()}`,
        dataType: EmployeeProfileFieldDataType.TEXT,
        required: false,
        visible: true,
        tabIds: [personalTab.id],
      })
      .expect(201);

    const field = created.body.fields.find(
      (f: { label: string }) => f.label.startsWith('E2E Custom'),
    );
    expect(field).toBeTruthy();

    const company = await request(getHttpServer(app))
      .post('/api/organization/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `E2E Co ${Date.now()}` })
      .expect(201);

    const phone = `09${String(Date.now()).slice(-8)}`;
    const emp = await request(getHttpServer(app))
      .post('/api/employees/check-or-create')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'E2E PROFILE CUSTOM',
        phone,
        managingCompanyId: company.body.id,
      })
      .expect(201);

    const profileId = emp.body.profile.id;
    const patched = await request(getHttpServer(app))
      .patch(`/api/employees/${profileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        employmentStatus: 'OFFICIAL',
        customValues: { [field.code]: 'gia-tri-custom' },
      })
      .expect(200);

    expect(patched.body.employmentStatus).toBe('OFFICIAL');
    expect(patched.body.customValues[field.code]).toBe('gia-tri-custom');
  });
});
