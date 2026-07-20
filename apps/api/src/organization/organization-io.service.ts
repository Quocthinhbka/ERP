import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { QueueService } from '../queue/queue.service';
import type { ApplySelection } from '@erp/organization-io';

@Injectable()
export class OrganizationIoService {
  constructor(private queueService: QueueService) {}

  private storageDir() {
    // monorepo root ERP_Sourcecode (api cwd is apps/api)
    return join(resolve(process.cwd(), '../..'), 'tmp', 'organization-io');
  }

  async enqueueExport() {
    return this.queueService.enqueueOrganizationExport();
  }

  async enqueueDiff(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File Excel không hợp lệ');
    }
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Chỉ hỗ trợ file .xlsx');
    }

    const dir = this.storageDir();
    await mkdir(dir, { recursive: true });
    const fileName = `upload-${Date.now()}-${basename(file.originalname)}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, file.buffer);

    return this.queueService.enqueueOrganizationDiff(filePath, file.originalname);
  }

  async enqueueApply(snapshotPath: string, selections: ApplySelection[]) {
    if (!snapshotPath || !existsSync(snapshotPath)) {
      throw new BadRequestException('Snapshot import không tồn tại');
    }
    return this.queueService.enqueueOrganizationApply(snapshotPath, selections ?? []);
  }

  async getJob(jobId: string) {
    const job = await this.queueService.getOrganizationIoJob(jobId);
    if (!job) {
      throw new NotFoundException('Job không tồn tại');
    }
    return job;
  }

  async downloadExport(jobId: string) {
    const job = await this.getJob(jobId);
    if (job.status !== 'completed' || !job.result?.filePath) {
      throw new BadRequestException('File export chưa sẵn sàng');
    }
    if (!existsSync(job.result.filePath)) {
      throw new NotFoundException('File export không tìm thấy');
    }
    const stream = createReadStream(job.result.filePath);
    return {
      file: new StreamableFile(stream),
      fileName: job.result.fileName ?? `organization-export-${jobId}.xlsx`,
    };
  }
}
