import { mkdir, writeFile, readFile } from 'fs/promises';
import { basename, join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { applyOrganizationSelections } from './apply.js';
import { diffOrganizationSnapshots } from './diff.js';
import { readOrganizationWorkbook, writeOrganizationWorkbook } from './excel.js';
import {
  detectOrganizationImportFormat,
  parseOrganizationSnapshotJson,
  serializeOrganizationSnapshot,
} from './json.js';
import { loadOrganizationSnapshot } from './snapshot.js';
import type {
  ApplySelection,
  OrganizationIoFormat,
  OrganizationIoJobResult,
  OrganizationSnapshot,
} from './types.js';

export function getOrganizationIoStorageDir(baseDir?: string) {
  return baseDir ?? join(process.cwd(), 'tmp', 'organization-io');
}

export async function ensureIoStorageDir(baseDir?: string) {
  const dir = getOrganizationIoStorageDir(baseDir);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function runOrganizationExport(
  prisma: PrismaClient,
  options?: {
    storageDir?: string;
    jobId?: string;
    format?: OrganizationIoFormat;
  },
): Promise<OrganizationIoJobResult> {
  const format: OrganizationIoFormat = options?.format ?? 'excel';
  const dir = await ensureIoStorageDir(options?.storageDir);
  const snapshot = await loadOrganizationSnapshot(prisma);
  const stamp = options?.jobId ?? Date.now();

  let fileName: string;
  let filePath: string;
  if (format === 'json') {
    fileName = `organization-export-${stamp}.json`;
    filePath = join(dir, fileName);
    await writeFile(filePath, serializeOrganizationSnapshot(snapshot), 'utf8');
  } else {
    const buffer = await writeOrganizationWorkbook(snapshot);
    fileName = `organization-export-${stamp}.xlsx`;
    filePath = join(dir, fileName);
    await writeFile(filePath, buffer);
  }

  return {
    success: true,
    filePath,
    fileName,
    stats: {
      companies: snapshot.companies.length,
      units: snapshot.units.length,
      organizationMembers: snapshot.organizationMembers.length,
      companyMembers: snapshot.companyMembers.length,
      unitMembers: snapshot.unitMembers.length,
    },
  };
}

async function readIncomingSnapshot(
  filePath: string,
  originalName?: string,
): Promise<OrganizationSnapshot> {
  const buffer = await readFile(filePath);
  const format = detectOrganizationImportFormat(
    originalName || basename(filePath),
  );
  if (format === 'json') {
    return parseOrganizationSnapshotJson(buffer);
  }
  return readOrganizationWorkbook(buffer);
}

export async function runOrganizationDiff(
  prisma: PrismaClient,
  filePath: string,
  options?: { storageDir?: string; jobId?: string; originalName?: string },
): Promise<OrganizationIoJobResult> {
  const dir = await ensureIoStorageDir(options?.storageDir);
  const incoming = await readIncomingSnapshot(filePath, options?.originalName);
  const current = await loadOrganizationSnapshot(prisma);
  const diff = diffOrganizationSnapshots(current, incoming);

  const snapshotPath = join(
    dir,
    `organization-incoming-${options?.jobId ?? Date.now()}.json`,
  );
  await writeFile(
    snapshotPath,
    serializeOrganizationSnapshot(incoming),
    'utf8',
  );

  return {
    success: true,
    filePath,
    snapshotPath,
    diff,
    errors: diff.errors,
  };
}

export async function runOrganizationApply(
  prisma: PrismaClient,
  snapshotPath: string,
  selections: ApplySelection[],
): Promise<OrganizationIoJobResult> {
  const incoming = parseOrganizationSnapshotJson(await readFile(snapshotPath));
  const current = await loadOrganizationSnapshot(prisma);
  const diff = diffOrganizationSnapshots(current, incoming);
  const applied = await applyOrganizationSelections(
    prisma,
    current,
    incoming,
    diff.changes,
    selections,
  );

  return {
    success: true,
    snapshotPath,
    applied: {
      created: applied.created,
      updated: applied.updated,
      deleted: applied.deleted,
    },
    errors: applied.errors,
  };
}

export async function restoreOrganizationFromSnapshot(
  prisma: PrismaClient,
  snapshot: OrganizationSnapshot,
): Promise<void> {
  const current = await loadOrganizationSnapshot(prisma);
  const diff = diffOrganizationSnapshots(current, snapshot);
  const selections = diff.changes
    .filter((c) => c.kind !== 'unchanged')
    .map((c) => ({ selectionKey: c.selectionKey }));
  await applyOrganizationSelections(
    prisma,
    current,
    snapshot,
    diff.changes,
    selections,
  );
}
