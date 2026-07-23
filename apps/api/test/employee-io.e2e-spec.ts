import { config } from 'dotenv';
import { resolve, join } from 'path';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  EMP_IO_JOB_APPLY,
  EMP_IO_JOB_DIFF,
  EMP_IO_JOB_EXPORT,
  EMP_IO_QUEUE_NAME,
  runEmployeeApply,
  runEmployeeDiff,
  runEmployeeExport,
  runEmployeeTemplateExport,
  writeEmployeeWorkbook,
  type ApplySelection,
  type EmployeeSnapshot,
  EMPLOYEE_IO_VERSION,
} from '@erp/employee-io';
import {
  EducationLevel,
  EmployeeGender,
  EmployeeProfileStatus,
} from '@erp/shared';
import { createTestApp, getHttpServer, loginAsAdmin } from './test-utils';

config({ path: resolve(__dirname, '../../../.env') });

async function waitJob(
  app: INestApplication,
  token: string,
  jobId: string,
  timeoutMs = 30000,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await request(getHttpServer(app))
      .get(`/api/employees/io/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    if (
      res.status === 200 &&
      (res.body.status === 'completed' || res.body.status === 'failed')
    ) {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Timeout waiting for employee-io job');
}

describe('Employee Import/Export (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let worker: Worker;
  let redis: Redis;
  let prisma: PrismaClient;
  let pool: Pool;
  let companyName = '';
  const storageDir = join(resolve(__dirname, '../../..'), 'tmp', 'employee-io');
  const createdIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const suffix = String(Date.now()).slice(-8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6380),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    worker = new Worker(
      EMP_IO_QUEUE_NAME,
      async (job) => {
        const requestedByUserId = (job.data as { requestedByUserId?: string })
          ?.requestedByUserId;
        if (job.name === EMP_IO_JOB_EXPORT) {
          const data = job.data as {
            template?: boolean;
            format?: 'excel' | 'json';
          };
          const template = Boolean(data.template);
          const format = data.format === 'json' ? 'json' : 'excel';
          if (template) {
            return runEmployeeTemplateExport({
              storageDir,
              jobId: String(job.id),
              requestedByUserId,
              format,
            });
          }
          return runEmployeeExport(prisma, {
            storageDir,
            jobId: String(job.id),
            requestedByUserId,
            format,
          });
        }
        if (job.name === EMP_IO_JOB_DIFF) {
          const { filePath, originalName } = job.data as {
            filePath: string;
            originalName?: string;
          };
          return runEmployeeDiff(prisma, filePath, {
            storageDir,
            jobId: String(job.id),
            requestedByUserId,
            originalName,
          });
        }
        if (job.name === EMP_IO_JOB_APPLY) {
          const { snapshotPath, selections } = job.data as {
            snapshotPath: string;
            selections: ApplySelection[];
          };
          return runEmployeeApply(prisma, snapshotPath, selections, {
            requestedByUserId,
          });
        }
        throw new Error(`Unknown job ${job.name}`);
      },
      { connection: redis },
    );

    app = await createTestApp();
    accessToken = await loginAsAdmin(app);

    companyName = `E2E EmpIO Co ${suffix}`;
    const company = await request(getHttpServer(app))
      .post('/api/organization/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: companyName })
      .expect(201);
    createdCompanyIds.push(company.body.id);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.employeeProfile.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: createdCompanyIds } },
      });
    }
    await worker.close();
    await redis.quit();
    await app.close();
    await prisma.$disconnect();
    await pool.end();
  });

  it('exports employee workbook via BullMQ', async () => {
    const enqueue = await request(getHttpServer(app))
      .post('/api/employees/io/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ format: 'excel' })
      .expect(201);

    const job = await waitJob(app, accessToken, enqueue.body.jobId);
    expect(job.status).toBe('completed');
    expect(job.result.fileName).toMatch(/\.xlsx$/);
    expect(job.result.hasFile).toBe(true);
    expect(job.result.filePath).toBeUndefined();

    const download = await request(getHttpServer(app))
      .get(`/api/employees/io/jobs/${enqueue.body.jobId}/download`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk as Buffer));
        res.on('end', () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(Buffer.isBuffer(download.body)).toBe(true);
    expect((download.body as Buffer).byteLength).toBeGreaterThan(1000);
  });

  it('exports employee snapshot as JSON', async () => {
    const enqueue = await request(getHttpServer(app))
      .post('/api/employees/io/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ format: 'json' })
      .expect(201);

    const job = await waitJob(app, accessToken, enqueue.body.jobId);
    expect(job.status).toBe('completed');
    expect(job.result.fileName).toMatch(/\.json$/);

    const download = await request(getHttpServer(app))
      .get(`/api/employees/io/jobs/${enqueue.body.jobId}/download`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk as Buffer));
        res.on('end', () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    const text = (download.body as Buffer).toString('utf8');
    const parsed = JSON.parse(text) as EmployeeSnapshot;
    expect(parsed.version).toBe(EMPLOYEE_IO_VERSION);
    expect(Array.isArray(parsed.employees)).toBe(true);
  });

  it('diffs and applies selected employee changes without deleting missing rows', async () => {
    const created = await request(getHttpServer(app))
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'nguyen van import',
        gender: 'MALE',
        birthDate: '1995-05-05',
        birthPlace: 'Ha Noi',
        placeOfOrigin: 'Ha Noi',
        permanentAddress: 'So 1 Ha Noi',
        currentAddress: 'So 2 Ha Noi',
        phone: `08${suffix}`,
        email: `import${suffix}@example.com`,
        ethnicity: 'Kinh',
        identityNumber: `00109500${suffix.slice(-4)}`.padStart(12, '0').slice(-12),
        identityIssuedDate: '2018-01-01',
        identityIssuedPlace: 'Cuc CSQLHC',
        educationLevel: 'UNIVERSITY',
        managingCompanyId: createdCompanyIds[0],
      })
      .expect(201);

    createdIds.push(created.body.id);

    const snapshot: EmployeeSnapshot = {
      version: EMPLOYEE_IO_VERSION,
      exportedAt: new Date().toISOString(),
      employees: [
        {
          id: created.body.id,
          profileCode: created.body.profileCode,
          fullName: 'NGUYỄN VĂN IMPORT',
          gender: EmployeeGender.MALE,
          birthDate: '1995-05-05',
          birthPlace: 'Ha Noi',
          placeOfOrigin: 'Ha Noi',
          permanentAddress: 'So 1 Ha Noi',
          currentAddress: 'So 99 Ha Noi',
          phone: `08${suffix}`,
          email: `import${suffix}@example.com`,
          ethnicity: 'Kinh',
          religion: null,
          identityNumber: created.body.identityNumber,
          identityIssuedDate: '2018-01-01',
          identityIssuedPlace: 'Cuc CSQLHC',
          educationLevel: EducationLevel.UNIVERSITY,
          status: EmployeeProfileStatus.PENDING_REVIEW,
          managingCompanyName: companyName,
          linkedAccountCode: null,
        },
        {
          id: `new:employee:99`,
          profileCode: '',
          fullName: 'TRAN THI MOI',
          gender: EmployeeGender.FEMALE,
          birthDate: '1999-09-09',
          birthPlace: 'Da Nang',
          placeOfOrigin: 'Da Nang',
          permanentAddress: 'So 3 Da Nang',
          currentAddress: 'So 4 Da Nang',
          phone: `07${suffix}`,
          email: `new${suffix}@example.com`,
          ethnicity: 'Kinh',
          religion: null,
          identityNumber: `00109900${suffix.slice(-4)}`.padStart(12, '0').slice(-12),
          identityIssuedDate: '2020-02-02',
          identityIssuedPlace: 'Cuc CSQLHC',
          educationLevel: EducationLevel.GRADE_12,
          status: EmployeeProfileStatus.PENDING_REVIEW,
          managingCompanyName: companyName,
          linkedAccountCode: null,
        },
      ],
      familyMembers: [],
      educationHistories: [],
      workHistories: [],
    };

    // writeEmployeeWorkbook will keep empty profileCode as-is; read assigns DRAFT.
    // For new row we leave profileCode blank in workbook by clearing after normalize path:
    snapshot.employees[1].profileCode = '';

    const buffer = await writeEmployeeWorkbook({
      ...snapshot,
      employees: snapshot.employees.map((row, index) =>
        index === 1 ? { ...row, profileCode: '' } : row,
      ),
    });

    const diffEnqueue = await request(getHttpServer(app))
      .post('/api/employees/io/import/diff')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, 'employees-import.xlsx')
      .expect(201);

    const diffJob = await waitJob(app, accessToken, diffEnqueue.body.jobId);
    expect(diffJob.status).toBe('completed');
    expect(diffJob.result.hasSnapshot).toBe(true);
    expect(diffJob.result.diff.stats.changed).toBeGreaterThanOrEqual(1);
    expect(diffJob.result.diff.stats.new).toBeGreaterThanOrEqual(1);

    const missing = diffJob.result.diff.changes.filter(
      (item: { kind: string }) => item.kind === 'missing_in_file',
    );
    expect(missing.every((item: { selectable: boolean }) => item.selectable === false)).toBe(
      true,
    );

    const selectable = diffJob.result.diff.changes.filter(
      (item: { selectable: boolean }) => item.selectable,
    );
    expect(selectable.length).toBeGreaterThan(0);

    const applyEnqueue = await request(getHttpServer(app))
      .post('/api/employees/io/import/apply')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        snapshotJobId: diffEnqueue.body.jobId,
        selections: selectable.map((item: { selectionKey: string }) => ({
          selectionKey: item.selectionKey,
        })),
      })
      .expect(201);

    const applyJob = await waitJob(app, accessToken, applyEnqueue.body.jobId);
    expect(applyJob.status).toBe('completed');
    expect(applyJob.result.applied.created + applyJob.result.applied.updated).toBeGreaterThan(
      0,
    );
    expect(applyJob.result.applied.deleted).toBe(0);

    const updated = await prisma.employeeProfile.findUnique({
      where: { id: created.body.id },
    });
    expect(updated?.currentAddress).toBe('So 99 Ha Noi');

    const createdNew = await prisma.employeeProfile.findFirst({
      where: { email: `new${suffix}@example.com` },
    });
    expect(createdNew).toBeTruthy();
    if (createdNew) createdIds.push(createdNew.id);

    // Hồ sơ gốc vẫn còn — missing_in_file không xóa.
    expect(
      await prisma.employeeProfile.findUnique({ where: { id: created.body.id } }),
    ).toBeTruthy();
  });

  it('imports JSON with blank gender without Prisma enum error', async () => {
    const snapshot: EmployeeSnapshot = {
      version: EMPLOYEE_IO_VERSION,
      exportedAt: new Date().toISOString(),
      employees: [
        {
          id: 'new:employee:blank-gender',
          profileCode: '',
          fullName: 'HO SO GENDER NULL',
          gender: null,
          birthDate: '1993-12-28',
          birthPlace: null,
          placeOfOrigin: null,
          permanentAddress: null,
          currentAddress: null,
          phone: `09${suffix}`,
          email: `blankgender${suffix}@example.com`,
          ethnicity: null,
          religion: null,
          identityNumber: `01909300${suffix.slice(-4)}`.padStart(12, '0').slice(-12),
          identityIssuedDate: null,
          identityIssuedPlace: null,
          educationLevel: null,
          status: EmployeeProfileStatus.INCOMPLETE,
          managingCompanyName: companyName,
          linkedAccountCode: null,
        },
      ],
      familyMembers: [],
      educationHistories: [],
      workHistories: [],
    };

    const buffer = Buffer.from(JSON.stringify(snapshot), 'utf8');
    const diffEnqueue = await request(getHttpServer(app))
      .post('/api/employees/io/import/diff')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, 'employees-blank-gender.json')
      .expect(201);

    const diffJob = await waitJob(app, accessToken, diffEnqueue.body.jobId);
    expect(diffJob.status).toBe('completed');
    expect(diffJob.result.diff.stats.new).toBeGreaterThanOrEqual(1);

    const selectable = diffJob.result.diff.changes.filter(
      (item: { selectable: boolean; kind: string }) =>
        item.selectable && item.kind === 'new',
    );
    expect(selectable.length).toBeGreaterThan(0);

    const applyEnqueue = await request(getHttpServer(app))
      .post('/api/employees/io/import/apply')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        snapshotJobId: diffEnqueue.body.jobId,
        selections: selectable.map((item: { selectionKey: string }) => ({
          selectionKey: item.selectionKey,
        })),
      })
      .expect(201);

    const applyJob = await waitJob(app, accessToken, applyEnqueue.body.jobId);
    expect(applyJob.status).toBe('completed');
    expect(applyJob.result.applied.created).toBeGreaterThanOrEqual(1);
    expect(applyJob.result.errors ?? []).toEqual([]);

    const createdNew = await prisma.employeeProfile.findFirst({
      where: { email: `blankgender${suffix}@example.com` },
      include: { managingCompany: { select: { name: true } } },
    });
    expect(createdNew).toBeTruthy();
    expect(createdNew?.gender).toBeNull();
    expect(createdNew?.managingCompany?.name).toBe(companyName);
    if (createdNew) createdIds.push(createdNew.id);
  });
});
