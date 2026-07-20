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
import { DEMO_QUEUE_NAME } from './constants.js';

config({ path: resolve(__dirname, '../../../.env') });

const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6380);
const storageDir = join(resolve(__dirname, '../../..'), 'tmp', 'organization-io');

const connection = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const demoWorker = new Worker(
  DEMO_QUEUE_NAME,
  async (job) => {
    const { message, enqueuedAt } = job.data as {
      message: string;
      enqueuedAt: string;
    };

    console.log(
      `[${new Date().toISOString()}] Processing job ${job.id}: "${message}" (enqueued: ${enqueuedAt})`,
    );

    return { processedAt: new Date().toISOString(), message };
  },
  { connection },
);

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

function attachLogs(worker: Worker, label: string) {
  worker.on('completed', (job) => {
    console.log(`[${label}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[${label}] Job ${job?.id} failed:`, err.message);
  });
}

attachLogs(demoWorker, 'demo');
attachLogs(orgIoWorker, 'organization-io');

console.log(
  `Worker started — queues "${DEMO_QUEUE_NAME}", "${ORG_IO_QUEUE_NAME}" (${redisHost}:${redisPort})`,
);

async function shutdown() {
  await demoWorker.close();
  await orgIoWorker.close();
  await prisma.$disconnect();
  await pool.end();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
