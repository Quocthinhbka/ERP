import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  getHttpServer,
  loginAsAdmin,
} from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

function personalPayload(suffix: string) {
  return {
    fullName: 'nguyễn văn kiểm thử',
    gender: 'MALE',
    birthDate: '1998-01-01',
    birthPlace: 'TP Hồ Chí Minh',
    placeOfOrigin: 'Hải Dương',
    permanentAddress: 'Số 1, Quận 1, TP.HCM',
    currentAddress: 'Số 2, Quận 3, TP.HCM',
    phone: `09${suffix}`,
    email: `employee${suffix}@example.com`,
    ethnicity: 'Kinh',
    identityNumber: `07912345${suffix.slice(-4)}`.padStart(12, '0').slice(-12),
    identityIssuedDate: '2020-01-15',
    identityIssuedPlace: 'Cục CSQLHC về TTXH',
    educationLevel: 'GRADE_12',
  };
}

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let prisma: PrismaService;
  let employeeId: string;
  const suffix = String(Date.now()).slice(-8);

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAsAdmin(app);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (employeeId) {
      await prisma.employeeProfile.deleteMany({ where: { id: employeeId } });
    }
    if ((await prisma.employeeProfile.count()) === 0) {
      await prisma.$executeRawUnsafe(
        `SELECT setval('employee_profile_code_seq', 1, false)`,
      );
    }
    await app.close();
  });

  it('creates an employee profile with generated code and uppercase name', async () => {
    const response = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send(personalPayload(suffix))
      .expect(201);

    employeeId = response.body.id;
    expect(response.body.profileCode).toMatch(/^HS-\d{5}$/);
    expect(response.body.fullName).toBe('NGUYỄN VĂN KIỂM THỬ');
    expect(response.body.email).toBe(`employee${suffix}@example.com`);
    expect(response.body.familyMembers).toEqual([]);
  });

  it('lists and searches employee profiles', async () => {
    const response = await request(getHttpServer(app))
      .get('/api/employees')
      .query({ search: `employee${suffix}@example.com`, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(
      response.body.items.some((item: { id: string }) => item.id === employeeId),
    ).toBe(true);
  });

  it('updates personal information only', async () => {
    const response = await request(getHttpServer(app))
      .patch(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ religion: 'NONE', strengths: 'Tin học' })
      .expect(200);

    expect(response.body.religion).toBe('NONE');
    expect(response.body.strengths).toBe('Tin học');
  });

  it('manages family members with unique relationship rules', async () => {
    const created = await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/family-members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        relationship: 'FATHER',
        fullName: 'nguyễn văn bố',
        birthYear: 1968,
        occupation: 'Giáo viên',
      })
      .expect(201);

    expect(created.body.fullName).toBe('NGUYỄN VĂN BỐ');

    await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/family-members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        relationship: 'FATHER',
        fullName: 'nguyễn văn khác',
      })
      .expect(409);

    const mother = await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/family-members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        relationship: 'MOTHER',
        fullName: 'nguyễn thị mẹ',
      })
      .expect(201);

    await request(getHttpServer(app))
      .patch(`/api/employees/${employeeId}/family-members/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ orderedIds: [mother.body.id, created.body.id] })
      .expect(200);

    const listed = await request(getHttpServer(app))
      .get(`/api/employees/${employeeId}/family-members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([
      mother.body.id,
      created.body.id,
    ]);
  });

  it('manages education and work histories with validation', async () => {
    const education = await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/education-histories`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromMonth: '2015-09',
        toMonth: '2019-06',
        institution: 'Đại học Kinh tế TP.HCM',
        major: 'Quản trị kinh doanh',
        trainingMode: 'REGULAR',
        degree: 'Cử nhân',
      })
      .expect(201);

    await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/education-histories`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromMonth: '2019-06',
        toMonth: '2015-09',
        institution: 'Đại học Kinh tế TP.HCM',
        major: 'Quản trị kinh doanh',
        trainingMode: 'REGULAR',
        degree: 'Cử nhân',
      })
      .expect(400);

    const work = await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/work-histories`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromMonth: '2022-01',
        company: 'Công ty ABC',
        department: 'Kinh doanh',
        position: 'Trưởng phòng',
      })
      .expect(201);

    expect(work.body.toMonth).toBeNull();

    await request(getHttpServer(app))
      .patch(`/api/employees/${employeeId}/education-histories/${education.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ degree: 'Thạc sĩ' })
      .expect(200);
  });

  it('requires mandatory personal fields', async () => {
    await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'THIẾU THÔNG TIN' })
      .expect(400);
  });

  it('soft-deletes the employee profile', async () => {
    const response = await request(getHttpServer(app))
      .delete(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.status).toBe('INACTIVE');
  });
});
