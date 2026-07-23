import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  ensureTestManagingCompany,
  getHttpServer,
  loginAsAdmin,
} from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

function personalPayload(suffix: string, managingCompanyId: string) {
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
    employmentStatus: 'OFFICIAL',
    managingCompanyId,
  };
}

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let prisma: PrismaService;
  let employeeId: string;
  let managingCompanyId: string;
  const suffix = String(Date.now()).slice(-8);

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAsAdmin(app);
    prisma = app.get(PrismaService);
    const company = await ensureTestManagingCompany(app, token);
    managingCompanyId = company.id;
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
      .send(personalPayload(suffix, managingCompanyId))
      .expect(201);

    employeeId = response.body.id;
    expect(response.body.profileCode).toMatch(/^HS-\d{5}$/);
    expect(response.body.fullName).toBe('NGUYỄN VĂN KIỂM THỬ');
    expect(response.body.email).toBe(`employee${suffix}@example.com`);
    expect(response.body.status).toBe('INCOMPLETE');
    expect(response.body.managingCompanyId).toBe(managingCompanyId);
    expect(response.body.familyMembers).toEqual([]);
  });

  it('lists employees filtered by statusIn', async () => {
    const response = await request(getHttpServer(app))
      .get('/api/employees')
      .query({ statusIn: ['INCOMPLETE'], page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every(
        (item: { status: string }) => item.status === 'INCOMPLETE',
      ),
    ).toBe(true);
  });

  it('lists employees filtered by managingCompanyIdIn', async () => {
    const list = await request(getHttpServer(app))
      .get('/api/employees')
      .query({ page: 1, pageSize: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const companyId = list.body.items?.[0]?.managingCompanyId as string | undefined;
    expect(companyId).toBeTruthy();

    const filtered = await request(getHttpServer(app))
      .get('/api/employees')
      .query({ managingCompanyIdIn: [companyId], page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(filtered.body.items.length).toBeGreaterThan(0);
    expect(
      filtered.body.items.every(
        (item: { managingCompanyId: string }) => item.managingCompanyId === companyId,
      ),
    ).toBe(true);
  });

  it('check-or-create returns existing profile by phone', async () => {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'Tổ chức' } });
    }
    let company = await prisma.company.findFirst({
      where: { organizationId: org.id },
      select: { id: true },
    });
    if (!company) {
      company = await prisma.company.create({
        data: { name: `E2E Company ${Date.now()}`, organizationId: org.id },
        select: { id: true },
      });
    }

    const created = await request(getHttpServer(app))
      .post('/api/employees/check-or-create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'hồ sơ trùng',
        phone: `09${suffix}`,
        managingCompanyId: company.id,
      })
      .expect(201);

    expect(created.body.created).toBe(false);
    expect(created.body.profile.id).toBe(employeeId);

    const phone = `08${String(Date.now()).slice(-8)}`;
    const fresh = await request(getHttpServer(app))
      .post('/api/employees/check-or-create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'hồ sơ mới dialog',
        phone,
        managingCompanyId: company.id,
      })
      .expect(201);

    expect(fresh.body.created).toBe(true);
    expect(fresh.body.profile.fullName).toBe('HỒ SƠ MỚI DIALOG');
    expect(fresh.body.profile.status).toBe('INCOMPLETE');
    expect(fresh.body.profile.managingCompanyId).toBe(company.id);
    await prisma.employeeProfile.delete({ where: { id: fresh.body.profile.id } });
  });

  it('lists and searches employee profiles', async () => {
    const response = await request(getHttpServer(app))
      .get('/api/employees')
      .query({ search: `09${suffix}`, page: 1, pageSize: 10 })
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

  it('requires phone and managing company when creating draft profile', async () => {
    await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'THIẾU SỐ ĐIỆN THOẠI', managingCompanyId })
      .expect(400);

    await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'THIẾU CÔNG TY',
        phone: `07${String(Date.now()).slice(-8)}`,
      })
      .expect(400);

    const draftPhone = `07${String(Date.now()).slice(-8)}`;
    const draft = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'hồ sơ nháp',
        phone: draftPhone,
        managingCompanyId,
      })
      .expect(201);
    expect(draft.body.status).toBe('INCOMPLETE');
    expect(draft.body.managingCompanyId).toBe(managingCompanyId);
    await prisma.employeeProfile.delete({ where: { id: draft.body.id } });
  });

  it('completes declaration and allows HR verify transitions', async () => {
    // Hồ sơ chính đã có family/education/work từ các test trước — Lưu sẽ auto Chờ xác nhận.
    const completed = await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(completed.body.status).toBe('PENDING_REVIEW');

    const verified = await request(getHttpServer(app))
      .patch(`/api/employees/${employeeId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'VERIFIED' })
      .expect(200);
    expect(verified.body.status).toBe('VERIFIED');
  });

  it('uploads, lists and deletes employee documents', async () => {
    const uploaded = await request(getHttpServer(app))
      .post(`/api/employees/${employeeId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('documentType', 'IDENTITY')
      .field('name', 'CCCD nhân viên')
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 'cccd.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(uploaded.body.name).toBe('CCCD nhân viên');
    expect(uploaded.body.fileUrl).toContain('/uploads/employee-documents/');

    const listed = await request(getHttpServer(app))
      .get(`/api/employees/${employeeId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);

    await request(getHttpServer(app))
      .delete(`/api/employees/${employeeId}/documents/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      await prisma.employeeDocument.count({
        where: { employeeProfileId: employeeId },
      }),
    ).toBe(0);
  });

  it('soft-deletes the employee profile', async () => {
    const response = await request(getHttpServer(app))
      .delete(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.status).toBe('LOCKED');
  });

  it('only hard-deletes the employee profile outside production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await request(getHttpServer(app))
        .delete(`/api/employees/${employeeId}/hard`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }

    await request(getHttpServer(app))
      .delete(`/api/employees/${employeeId}/hard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      await prisma.employeeProfile.findUnique({ where: { id: employeeId } }),
    ).toBeNull();
    expect(
      await prisma.employeeFamilyMember.count({
        where: { employeeProfileId: employeeId },
      }),
    ).toBe(0);
    expect(
      await prisma.employeeEducationHistory.count({
        where: { employeeProfileId: employeeId },
      }),
    ).toBe(0);
    expect(
      await prisma.employeeWorkHistory.count({
        where: { employeeProfileId: employeeId },
      }),
    ).toBe(0);
    employeeId = '';
  });

  it('uploads and removes employee avatar', async () => {
    const created = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send(personalPayload(`${String(Date.now()).slice(-8)}`, managingCompanyId))
      .expect(201);
    const id = created.body.id as string;

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const uploaded = await request(getHttpServer(app))
      .post(`/api/employees/${id}/avatar`)
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);

    expect(uploaded.body.avatarUrl).toMatch(
      new RegExp(`^/uploads/employees/${id}/avatar\\.png$`),
    );

    const removed = await request(getHttpServer(app))
      .delete(`/api/employees/${id}/avatar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(removed.body.avatarUrl).toBeNull();

    await request(getHttpServer(app))
      .delete(`/api/employees/${id}/hard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
