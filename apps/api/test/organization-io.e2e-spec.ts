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
  ORG_IO_JOB_APPLY,
  ORG_IO_JOB_DIFF,
  ORG_IO_JOB_EXPORT,
  ORG_IO_QUEUE_NAME,
  loadOrganizationSnapshot,
  restoreOrganizationFromSnapshot,
  runOrganizationApply,
  runOrganizationDiff,
  runOrganizationExport,
  type ApplySelection,
  type OrganizationSnapshot,
} from '@erp/organization-io';
import { createTestApp, getHttpServer } from './test-utils';

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
      .get(`/api/organization/io/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200 && (res.body.status === 'completed' || res.body.status === 'failed')) {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Timeout waiting for organization-io job');
}

describe('Organization Import/Export (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let worker: Worker;
  let redis: Redis;
  let prisma: PrismaClient;
  let pool: Pool;
  let backup: OrganizationSnapshot;
  const storageDir = join(resolve(__dirname, '../../..'), 'tmp', 'organization-io');

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    backup = await loadOrganizationSnapshot(prisma);

    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6380),
      maxRetriesPerRequest: null,
    });

    worker = new Worker(
      ORG_IO_QUEUE_NAME,
      async (job) => {
        if (job.name === ORG_IO_JOB_EXPORT) {
          return runOrganizationExport(prisma, { storageDir, jobId: String(job.id) });
        }
        if (job.name === ORG_IO_JOB_DIFF) {
          const { filePath } = job.data as { filePath: string };
          return runOrganizationDiff(prisma, filePath, { storageDir, jobId: String(job.id) });
        }
        if (job.name === ORG_IO_JOB_APPLY) {
          const { snapshotPath, selections } = job.data as {
            snapshotPath: string;
            selections: ApplySelection[];
          };
          return runOrganizationApply(prisma, snapshotPath, selections);
        }
        throw new Error(`Unknown job ${job.name}`);
      },
      { connection: redis },
    );

    app = await createTestApp();
    const login = await request(getHttpServer(app))
      .post('/api/auth/login')
      .send({ email: 'admin@hyperlabs.vn', password: 'Admin@123' });
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    try {
      await restoreOrganizationFromSnapshot(prisma, backup);
    } finally {
      await worker.close();
      await redis.quit();
      await app.close();
      await prisma.$disconnect();
      await pool.end();
    }
  });

  it('exports organization workbook via BullMQ', async () => {
    const enqueue = await request(getHttpServer(app))
      .post('/api/organization/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const job = await waitJob(app, accessToken, enqueue.body.jobId);
    expect(job.status).toBe('completed');
    expect(job.result.fileName).toMatch(/\.xlsx$/);

    const download = await request(getHttpServer(app))
      .get(`/api/organization/io/jobs/${enqueue.body.jobId}/download`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk as Buffer));
        res.on('end', () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(download.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(Buffer.isBuffer(download.body) ? download.body.length : 0).toBeGreaterThan(0);
  });

  it('imports excel, returns selectable diff, and restores after apply none', async () => {
    const exportJob = await request(getHttpServer(app))
      .post('/api/organization/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const completedExport = await waitJob(app, accessToken, exportJob.body.jobId);
    const fileRes = await request(getHttpServer(app))
      .get(`/api/organization/io/jobs/${exportJob.body.jobId}/download`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    const diffJob = await request(getHttpServer(app))
      .post('/api/organization/import/diff')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', fileRes.body, completedExport.result.fileName)
      .expect(201);

    const completedDiff = await waitJob(app, accessToken, diffJob.body.jobId);
    expect(completedDiff.status).toBe('completed');
    expect(completedDiff.result.diff).toBeDefined();
    expect(completedDiff.result.snapshotPath).toBeDefined();

    // Apply empty selection — no DB mutation
    const applyJob = await request(getHttpServer(app))
      .post('/api/organization/import/apply')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        snapshotPath: completedDiff.result.snapshotPath,
        selections: [],
      })
      .expect(201);

    const completedApply = await waitJob(app, accessToken, applyJob.body.jobId);
    expect(completedApply.status).toBe('completed');
    expect(completedApply.result.applied.created).toBe(0);
    expect(completedApply.result.applied.updated).toBe(0);
    expect(completedApply.result.applied.deleted).toBe(0);
  });
});
