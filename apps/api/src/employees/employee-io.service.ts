import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join, resolve, sep } from 'path';
import type { ApplySelection, EmployeeIoFormat } from '@erp/employee-io';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class EmployeeIoService {
  constructor(
    private queueService: QueueService,
    private config: ConfigService,
  ) {}

  private storageDir() {
    return resolve(join(resolve(process.cwd(), '../..'), 'tmp', 'employee-io'));
  }

  private maxUploadBytes() {
    const raw = this.config.get<string>('UPLOAD_MAX_BYTES');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 1024 * 1024;
  }

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

  private assertOwner(
    job: { requestedByUserId?: string | null },
    userId: string,
  ) {
    if (job.requestedByUserId && job.requestedByUserId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập job này');
    }
  }

  async enqueueExport(
    userId: string,
    options?: { template?: boolean; format?: EmployeeIoFormat },
  ) {
    return this.queueService.enqueueEmployeeExport(userId, {
      template: options?.template ?? false,
      format: options?.format ?? 'excel',
    });
  }

  async enqueueDiff(userId: string, file: Express.Multer.File) {
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

    return this.queueService.enqueueEmployeeDiff(
      filePath,
      file.originalname,
      userId,
    );
  }

  async enqueueApply(
    userId: string,
    snapshotJobId: string,
    selections: ApplySelection[],
  ) {
    if (!snapshotJobId) {
      throw new BadRequestException('Thiếu snapshotJobId');
    }
    if (!selections?.length) {
      throw new BadRequestException('Chưa chọn thay đổi để áp dụng');
    }

    const job = await this.queueService.getEmployeeIoJob(snapshotJobId);
    if (!job || job.status !== 'completed' || !job.result?.snapshotPath) {
      throw new BadRequestException('Snapshot import không tồn tại');
    }
    this.assertOwner(job, userId);

    // Chỉ cho phép NEW/CHANGED — bỏ selection missing_in_file nếu client gửi nhầm.
    const safeSelections = selections.filter(
      (item) => !String(item.selectionKey).includes(':missing'),
    );
    const selectableFromDiff =
      job.result.diff?.changes
        .filter((change) => change.selectable)
        .map((change) => change.selectionKey) ?? [];
    const allowed = new Set(selectableFromDiff);
    const filtered = safeSelections.filter((item) => allowed.has(item.selectionKey));
    if (filtered.length === 0) {
      throw new BadRequestException('Không có thay đổi hợp lệ để áp dụng');
    }

    const snapshotPath = this.resolveStoragePath(String(job.result.snapshotPath));
    return this.queueService.enqueueEmployeeApply(
      snapshotPath,
      filtered,
      userId,
    );
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.queueService.getEmployeeIoJob(jobId);
    if (!job) {
      throw new NotFoundException('Job không tồn tại');
    }
    this.assertOwner(job, userId);
    return this.sanitizeJobForClient(job);
  }

  async downloadExport(jobId: string, userId: string) {
    const job = await this.queueService.getEmployeeIoJob(jobId);
    if (!job) {
      throw new NotFoundException('Job không tồn tại');
    }
    this.assertOwner(job, userId);
    if (job.status !== 'completed' || !job.result?.filePath) {
      throw new BadRequestException('File export chưa sẵn sàng');
    }
    const filePath = this.resolveStoragePath(String(job.result.filePath));
    const fileName = job.result.fileName ?? `employee-export-${jobId}.xlsx`;
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

  private sanitizeJobForClient(
    job: NonNullable<Awaited<ReturnType<QueueService['getEmployeeIoJob']>>>,
  ) {
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
