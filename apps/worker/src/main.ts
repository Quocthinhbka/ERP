import { config } from 'dotenv';
import { resolve } from 'path';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { DEMO_QUEUE_NAME } from './constants.js';

config({ path: resolve(__dirname, '../../../.env') });

const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6380);

const connection = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
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

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log(`Worker started — listening on queue "${DEMO_QUEUE_NAME}" (${redisHost}:${redisPort})`);

async function shutdown() {
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
