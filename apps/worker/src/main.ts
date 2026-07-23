import { config } from 'dotenv';
import { resolve, join } from 'path';
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
  runOrganizationApply,
  runOrganizationDiff,
  runOrganizationExport,
  type ApplySelection as OrgApplySelection,
} from '@erp/organization-io';
import {
  EMP_IO_JOB_APPLY,
  EMP_IO_JOB_DIFF,
  EMP_IO_JOB_EXPORT,
  EMP_IO_QUEUE_NAME,
  runEmployeeApply,
  runEmployeeDiff,
  runEmployeeExport,
  runEmployeeTemplateExport,
  type ApplySelection as EmpApplySelection,
} from '@erp/employee-io';

config({ path: resolve(__dirname, '../../../.env') });

const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6380);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const orgStorageDir = join(resolve(__dirname, '../../..'), 'tmp', 'organization-io');
const empStorageDir = join(resolve(__dirname, '../../..'), 'tmp', 'employee-io');

const connection = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const orgIoWorker = new Worker(
  ORG_IO_QUEUE_NAME,
  async (job) => {
    if (job.name === ORG_IO_JOB_EXPORT) {
      const { format } = job.data as { format?: 'excel' | 'json' };
      return runOrganizationExport(prisma, {
        storageDir: orgStorageDir,
        jobId: String(job.id),
        format: format === 'json' ? 'json' : 'excel',
      });
    }

    if (job.name === ORG_IO_JOB_DIFF) {
      const { filePath, originalName } = job.data as {
        filePath: string;
        originalName?: string;
      };
      return runOrganizationDiff(prisma, filePath, {
        storageDir: orgStorageDir,
        jobId: String(job.id),
        originalName,
      });
    }

    if (job.name === ORG_IO_JOB_APPLY) {
      const { snapshotPath, selections } = job.data as {
        snapshotPath: string;
        selections: OrgApplySelection[];
      };
      return runOrganizationApply(prisma, snapshotPath, selections);
    }

    throw new Error(`Unknown organization-io job: ${job.name}`);
  },
  { connection },
);

const empIoWorker = new Worker(
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
          storageDir: empStorageDir,
          jobId: String(job.id),
          requestedByUserId,
          format,
        });
      }
      return runEmployeeExport(prisma, {
        storageDir: empStorageDir,
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
        storageDir: empStorageDir,
        jobId: String(job.id),
        requestedByUserId,
        originalName,
      });
    }

    if (job.name === EMP_IO_JOB_APPLY) {
      const { snapshotPath, selections } = job.data as {
        snapshotPath: string;
        selections: EmpApplySelection[];
      };
      return runEmployeeApply(prisma, snapshotPath, selections, {
        requestedByUserId,
      });
    }

    throw new Error(`Unknown employee-io job: ${job.name}`);
  },
  { connection },
);

orgIoWorker.on('completed', (job) => {
  console.log(`[organization-io] Job ${job.id} completed`);
});
orgIoWorker.on('failed', (job, err) => {
  console.error(`[organization-io] Job ${job?.id} failed:`, err.message);
});

empIoWorker.on('completed', (job) => {
  console.log(`[employee-io] Job ${job.id} completed`);
});
empIoWorker.on('failed', (job, err) => {
  console.error(`[employee-io] Job ${job?.id} failed:`, err.message);
});

console.log(
  `Worker started — queues "${ORG_IO_QUEUE_NAME}", "${EMP_IO_QUEUE_NAME}" (${redisHost}:${redisPort})`,
);

async function shutdown() {
  await orgIoWorker.close();
  await empIoWorker.close();
  await prisma.$disconnect();
  await pool.end();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
