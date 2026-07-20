import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const DEMO_QUEUE_NAME = 'erp-demo';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection: Redis;
  private demoQueue: Queue;

  constructor(config: ConfigService) {
    this.connection = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6380),
      maxRetriesPerRequest: null,
    });

    this.demoQueue = new Queue(DEMO_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueueDemoJob(message: string) {
    const job = await this.demoQueue.add(
      'process-demo',
      { message, enqueuedAt: new Date().toISOString() },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return {
      jobId: job.id,
      queue: DEMO_QUEUE_NAME,
      status: 'queued',
    };
  }

  async onModuleDestroy() {
    await this.demoQueue.close();
    await this.connection.quit();
  }
}
