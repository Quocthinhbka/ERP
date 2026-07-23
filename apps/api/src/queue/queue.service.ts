import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import {
  ORG_IO_JOB_APPLY,
  ORG_IO_JOB_DIFF,
  ORG_IO_JOB_EXPORT,
  ORG_IO_QUEUE_NAME,
  type ApplySelection as OrgApplySelection,
  type OrganizationIoJobResult,
} from '@erp/organization-io';
import {
  EMP_IO_JOB_APPLY,
  EMP_IO_JOB_DIFF,
  EMP_IO_JOB_EXPORT,
  EMP_IO_QUEUE_NAME,
  type ApplySelection as EmpApplySelection,
  type EmployeeIoJobResult,
} from '@erp/employee-io';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection: Redis;
  private orgIoQueue: Queue;
  private empIoQueue: Queue;

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
    this.empIoQueue = new Queue(EMP_IO_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueueOrganizationExport(format: 'excel' | 'json' = 'excel') {
    const job = await this.orgIoQueue.add(
      ORG_IO_JOB_EXPORT,
      { format, enqueuedAt: new Date().toISOString() },
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

  async enqueueOrganizationApply(
    snapshotPath: string,
    selections: OrgApplySelection[],
  ) {
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
    return this.mapJob<OrganizationIoJobResult>(job);
  }

  async enqueueEmployeeExport(
    requestedByUserId: string,
    options?: { template?: boolean; format?: 'excel' | 'json' },
  ) {
    const job = await this.empIoQueue.add(
      EMP_IO_JOB_EXPORT,
      {
        template: options?.template ?? false,
        format: options?.format ?? 'excel',
        requestedByUserId,
        enqueuedAt: new Date().toISOString(),
      },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, queue: EMP_IO_QUEUE_NAME, status: 'queued' as const };
  }

  async enqueueEmployeeDiff(
    filePath: string,
    originalName: string,
    requestedByUserId: string,
  ) {
    const job = await this.empIoQueue.add(
      EMP_IO_JOB_DIFF,
      {
        filePath,
        originalName,
        requestedByUserId,
        enqueuedAt: new Date().toISOString(),
      },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, queue: EMP_IO_QUEUE_NAME, status: 'queued' as const };
  }

  async enqueueEmployeeApply(
    snapshotPath: string,
    selections: EmpApplySelection[],
    requestedByUserId: string,
  ) {
    const job = await this.empIoQueue.add(
      EMP_IO_JOB_APPLY,
      {
        snapshotPath,
        selections,
        requestedByUserId,
        enqueuedAt: new Date().toISOString(),
      },
      { removeOnComplete: 50, removeOnFail: 50 },
    );
    return { jobId: job.id, queue: EMP_IO_QUEUE_NAME, status: 'queued' as const };
  }

  async getEmployeeIoJob(jobId: string) {
    const job = await this.empIoQueue.getJob(jobId);
    if (!job) return null;
    return this.mapJob<EmployeeIoJobResult>(job);
  }

  private async mapJob<T>(job: Job) {
    const state = await job.getState();
    const result = job.returnvalue as T | undefined;
    const data = job.data as { requestedByUserId?: string };
    return {
      jobId: job.id,
      name: job.name,
      status: state,
      progress: job.progress,
      result: result ?? null,
      failedReason: job.failedReason ?? null,
      requestedByUserId: data?.requestedByUserId ?? null,
    };
  }

  async onModuleDestroy() {
    await this.orgIoQueue.close();
    await this.empIoQueue.close();
    await this.connection.quit();
  }
}
