import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import {
  ORG_IO_JOB_APPLY,
  ORG_IO_JOB_DIFF,
  ORG_IO_JOB_EXPORT,
  ORG_IO_QUEUE_NAME,
  type ApplySelection,
  type OrganizationIoJobResult,
} from '@erp/organization-io';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection: Redis;
  private orgIoQueue: Queue;

  constructor(config: ConfigService) {
    const password = config.get<string>('REDIS_PASSWORD');
    this.connection = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6380),
      password: password || undefined,
      maxRetriesPerRequest: null,
    });

    this.orgIoQueue = new Queue(ORG_IO_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueueOrganizationExport() {
    const job = await this.orgIoQueue.add(
      ORG_IO_JOB_EXPORT,
      { enqueuedAt: new Date().toISOString() },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, queue: ORG_IO_QUEUE_NAME, status: 'queued' as const };
  }

  async enqueueOrganizationDiff(filePath: string, originalName: string) {
    const job = await this.orgIoQueue.add(
      ORG_IO_JOB_DIFF,
      { filePath, originalName, enqueuedAt: new Date().toISOString() },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, queue: ORG_IO_QUEUE_NAME, status: 'queued' as const };
  }

  async enqueueOrganizationApply(snapshotPath: string, selections: ApplySelection[]) {
    const job = await this.orgIoQueue.add(
      ORG_IO_JOB_APPLY,
      { snapshotPath, selections, enqueuedAt: new Date().toISOString() },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, queue: ORG_IO_QUEUE_NAME, status: 'queued' as const };
  }

  async getOrganizationIoJob(jobId: string) {
    const job = await this.orgIoQueue.getJob(jobId);
    if (!job) return null;
    return this.mapJob(job);
  }

  private async mapJob(job: Job) {
    const state = await job.getState();
    const result = job.returnvalue as OrganizationIoJobResult | undefined;
    return {
      jobId: job.id,
      name: job.name,
      status: state,
      progress: job.progress,
      result: result ?? null,
      failedReason: job.failedReason ?? null,
    };
  }

  async onModuleDestroy() {
    await this.orgIoQueue.close();
    await this.connection.quit();
  }
}
