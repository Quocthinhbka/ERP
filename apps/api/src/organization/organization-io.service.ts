import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join, resolve, sep } from 'path';
import { QueueService } from '../queue/queue.service';
import type { ApplySelection, OrganizationIoFormat } from '@erp/organization-io';

@Injectable()
export class OrganizationIoService {
  constructor(
    private queueService: QueueService,
    private config: ConfigService,
  ) {}

  private storageDir() {
    // monorepo root (api cwd is apps/api)
    return resolve(join(resolve(process.cwd(), '../..'), 'tmp', 'organization-io'));
  }

  private maxUploadBytes() {
    const raw = this.config.get<string>('UPLOAD_MAX_BYTES');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 1024 * 1024;
  }

  /** Chỉ cho phép path nằm trong thư mục storage tổ chức. */
  resolveStoragePath(candidate: string) {
    if (!candidate) {
      throw new BadRequestException('Snapshot import không hợp lệ');
    }

    const dir = this.storageDir();
    const resolved = resolve(
      candidate.includes(sep) || candidate.includes('/')
        ? candidate
        : join(dir, basename(candidate)),
    );

    const prefix = dir.endsWith(sep) ? dir : `${dir}${sep}`;
    if (resolved !== dir && !resolved.startsWith(prefix)) {
      throw new BadRequestException('Snapshot import không hợp lệ');
    }
    if (!existsSync(resolved)) {
      throw new BadRequestException('Snapshot import không tồn tại');
    }
    return resolved;
  }

  async enqueueExport(format: OrganizationIoFormat = 'excel') {
    return this.queueService.enqueueOrganizationExport(format);
  }

  async enqueueDiff(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File import không hợp lệ');
    }
    const lower = file.originalname.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.json')) {
      throw new BadRequestException('Chỉ hỗ trợ file .xlsx hoặc .json');
    }
    if (file.size > this.maxUploadBytes()) {
      throw new BadRequestException('File vượt quá kích thước cho phép');
    }

    const dir = this.storageDir();
    await mkdir(dir, { recursive: true });
    const fileName = `upload-${Date.now()}-${basename(file.originalname)}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, file.buffer);

    return this.queueService.enqueueOrganizationDiff(filePath, file.originalname);
  }

  async enqueueApply(snapshotJobId: string, selections: ApplySelection[]) {
    if (!snapshotJobId) {
      throw new BadRequestException('Thiếu snapshotJobId');
    }

    const job = await this.queueService.getOrganizationIoJob(snapshotJobId);
    if (!job || job.status !== 'completed' || !job.result?.snapshotPath) {
      throw new BadRequestException('Snapshot import không tồn tại');
    }

    const snapshotPath = this.resolveStoragePath(String(job.result.snapshotPath));
    return this.queueService.enqueueOrganizationApply(snapshotPath, selections ?? []);
  }

  async getJob(jobId: string) {
    const job = await this.queueService.getOrganizationIoJob(jobId);
    if (!job) {
      throw new NotFoundException('Job không tồn tại');
    }
    return this.sanitizeJobForClient(job);
  }

  async downloadExport(jobId: string) {
    const job = await this.queueService.getOrganizationIoJob(jobId);
    if (!job) {
      throw new NotFoundException('Job không tồn tại');
    }
    if (job.status !== 'completed' || !job.result?.filePath) {
      throw new BadRequestException('File export chưa sẵn sàng');
    }
    const filePath = this.resolveStoragePath(String(job.result.filePath));
    const fileName =
      job.result.fileName ?? `organization-export-${jobId}.xlsx`;
    const contentType = String(fileName).toLowerCase().endsWith('.json')
      ? 'application/json; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const stream = createReadStream(filePath);
    return {
      file: new StreamableFile(stream),
      fileName,
      contentType,
    };
  }

  /** Không trả đường dẫn filesystem tuyệt đối ra client. */
  private sanitizeJobForClient(job: Awaited<ReturnType<QueueService['getOrganizationIoJob']>>) {
    if (!job) return job;
    const result = job.result
      ? {
          ...job.result,
          snapshotPath: undefined,
          filePath: undefined,
          hasSnapshot: Boolean(job.result.snapshotPath),
          hasFile: Boolean(job.result.filePath),
        }
      : null;
    return { ...job, result };
  }
}
