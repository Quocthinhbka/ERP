import { mkdir, writeFile, readFile, readdir, unlink, stat } from 'fs/promises';
import { basename, join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { applyEmployeeSelections } from './apply.js';
import { diffEmployeeSnapshots } from './diff.js';
import {
  readEmployeeWorkbook,
  writeEmployeeTemplateWorkbook,
  writeEmployeeWorkbook,
} from './excel.js';
import {
  detectEmployeeImportFormat,
  parseEmployeeSnapshotJson,
  serializeEmployeeSnapshot,
} from './json.js';
import { loadEmployeeSnapshot } from './snapshot.js';
import type {
  ApplySelection,
  EmployeeIoFormat,
  EmployeeIoJobResult,
  EmployeeSnapshot,
} from './types.js';
import { EMPLOYEE_IO_VERSION } from './types.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function getEmployeeIoStorageDir(baseDir?: string) {
  return baseDir ?? join(process.cwd(), 'tmp', 'employee-io');
}

export async function ensureEmployeeIoStorageDir(baseDir?: string) {
  const dir = getEmployeeIoStorageDir(baseDir);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Dọn file tạm cũ hơn TTL (mặc định 24h). */
export async function cleanupEmployeeIoStorage(
  baseDir?: string,
  ttlMs = DEFAULT_TTL_MS,
) {
  const dir = await ensureEmployeeIoStorageDir(baseDir);
  const entries = await readdir(dir);
  const now = Date.now();
  await Promise.all(
    entries.map(async (name) => {
      const fullPath = join(dir, name);
      try {
        const info = await stat(fullPath);
        if (now - info.mtimeMs > ttlMs) {
          await unlink(fullPath);
        }
      } catch {
        // ignore cleanup errors
      }
    }),
  );
}

export async function runEmployeeExport(
  prisma: PrismaClient,
  options?: {
    storageDir?: string;
    jobId?: string;
    requestedByUserId?: string;
    format?: EmployeeIoFormat;
  },
): Promise<EmployeeIoJobResult> {
  const format: EmployeeIoFormat = options?.format ?? 'excel';
  const dir = await ensureEmployeeIoStorageDir(options?.storageDir);
  await cleanupEmployeeIoStorage(dir);
  const snapshot = await loadEmployeeSnapshot(prisma);
  const stamp = options?.jobId ?? Date.now();

  let fileName: string;
  let filePath: string;
  if (format === 'json') {
    fileName = `employee-export-${stamp}.json`;
    filePath = join(dir, fileName);
    await writeFile(filePath, serializeEmployeeSnapshot(snapshot), 'utf8');
  } else {
    const buffer = await writeEmployeeWorkbook(snapshot);
    fileName = `employee-export-${stamp}.xlsx`;
    filePath = join(dir, fileName);
    await writeFile(filePath, buffer);
  }

  return {
    success: true,
    filePath,
    fileName,
    requestedByUserId: options?.requestedByUserId,
    stats: {
      employees: snapshot.employees.length,
      familyMembers: snapshot.familyMembers.length,
      educationHistories: snapshot.educationHistories.length,
      workHistories: snapshot.workHistories.length,
    },
  };
}

export async function runEmployeeTemplateExport(
  options?: {
    storageDir?: string;
    jobId?: string;
    requestedByUserId?: string;
    format?: EmployeeIoFormat;
  },
): Promise<EmployeeIoJobResult> {
  const format: EmployeeIoFormat = options?.format ?? 'excel';
  const dir = await ensureEmployeeIoStorageDir(options?.storageDir);
  const stamp = options?.jobId ?? Date.now();

  let fileName: string;
  let filePath: string;
  if (format === 'json') {
    const empty: EmployeeSnapshot = {
      version: EMPLOYEE_IO_VERSION,
      exportedAt: new Date().toISOString(),
      employees: [],
      familyMembers: [],
      educationHistories: [],
      workHistories: [],
    };
    fileName = `employee-template-${stamp}.json`;
    filePath = join(dir, fileName);
    await writeFile(filePath, serializeEmployeeSnapshot(empty), 'utf8');
  } else {
    const buffer = await writeEmployeeTemplateWorkbook();
    fileName = `employee-template-${stamp}.xlsx`;
    filePath = join(dir, fileName);
    await writeFile(filePath, buffer);
  }

  return {
    success: true,
    filePath,
    fileName,
    requestedByUserId: options?.requestedByUserId,
    stats: {
      employees: 0,
      familyMembers: 0,
      educationHistories: 0,
      workHistories: 0,
    },
  };
}

async function readIncomingSnapshot(
  filePath: string,
  originalName?: string,
): Promise<EmployeeSnapshot> {
  const buffer = await readFile(filePath);
  const format = detectEmployeeImportFormat(
    originalName || basename(filePath),
  );
  if (format === 'json') {
    return parseEmployeeSnapshotJson(buffer);
  }
  return readEmployeeWorkbook(buffer);
}

export async function runEmployeeDiff(
  prisma: PrismaClient,
  filePath: string,
  options?: {
    storageDir?: string;
    jobId?: string;
    requestedByUserId?: string;
    originalName?: string;
  },
): Promise<EmployeeIoJobResult> {
  const dir = await ensureEmployeeIoStorageDir(options?.storageDir);
  await cleanupEmployeeIoStorage(dir);
  const incoming = await readIncomingSnapshot(filePath, options?.originalName);
  const current = await loadEmployeeSnapshot(prisma);
  const diff = diffEmployeeSnapshots(current, incoming);

  const snapshotPath = join(
    dir,
    `employee-incoming-${options?.jobId ?? Date.now()}.json`,
  );
  await writeFile(snapshotPath, serializeEmployeeSnapshot(incoming), 'utf8');

  return {
    success: true,
    filePath,
    snapshotPath,
    requestedByUserId: options?.requestedByUserId,
    diff,
    errors: diff.errors,
  };
}

export async function runEmployeeApply(
  prisma: PrismaClient,
  snapshotPath: string,
  selections: ApplySelection[],
  options?: { requestedByUserId?: string },
): Promise<EmployeeIoJobResult> {
  const incoming = parseEmployeeSnapshotJson(await readFile(snapshotPath));
  const current = await loadEmployeeSnapshot(prisma);
  const diff = diffEmployeeSnapshots(current, incoming);
  const applied = await applyEmployeeSelections(
    prisma,
    current,
    incoming,
    diff.changes,
    selections,
  );

  return {
    success: true,
    snapshotPath,
    requestedByUserId: options?.requestedByUserId,
    applied: {
      created: applied.created,
      updated: applied.updated,
      deleted: applied.deleted,
    },
    errors: applied.errors,
  };
}
