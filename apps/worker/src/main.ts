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
  type ApplySelection,
} from '@erp/organization-io';

config({ path: resolve(__dirname, '../../../.env') });

const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6380);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const storageDir = join(resolve(__dirname, '../../..'), 'tmp', 'organization-io');

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

    throw new Error(`Unknown organization-io job: ${job.name}`);
  },
  { connection },
);

orgIoWorker.on('completed', (job) => {
  console.log(`[organization-io] Job ${job.id} completed`);
});
orgIoWorker.on('failed', (job, err) => {
  console.error(`[organization-io] Job ${job?.id} failed:`, err.message);
});

console.log(
  `Worker started — queue "${ORG_IO_QUEUE_NAME}" (${redisHost}:${redisPort})`,
);

async function shutdown() {
  await orgIoWorker.close();
  await prisma.$disconnect();
  await pool.end();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
