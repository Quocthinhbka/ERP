import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { applyOrganizationSelections } from './apply.js';
import { diffOrganizationSnapshots } from './diff.js';
import { readOrganizationWorkbook, writeOrganizationWorkbook } from './excel.js';
import { loadOrganizationSnapshot } from './snapshot.js';
import type {
  ApplySelection,
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
  options?: { storageDir?: string; jobId?: string },
): Promise<OrganizationIoJobResult> {
  const dir = await ensureIoStorageDir(options?.storageDir);
  const snapshot = await loadOrganizationSnapshot(prisma);
  const buffer = await writeOrganizationWorkbook(snapshot);
  const fileName = `organization-export-${options?.jobId ?? Date.now()}.xlsx`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, buffer);

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

export async function runOrganizationDiff(
  prisma: PrismaClient,
  filePath: string,
  options?: { storageDir?: string; jobId?: string },
): Promise<OrganizationIoJobResult> {
  const dir = await ensureIoStorageDir(options?.storageDir);
  const buffer = await readFile(filePath);
  const incoming = await readOrganizationWorkbook(buffer);
  const current = await loadOrganizationSnapshot(prisma);
  const diff = diffOrganizationSnapshots(current, incoming);

  const snapshotPath = join(dir, `organization-incoming-${options?.jobId ?? Date.now()}.json`);
  await writeFile(snapshotPath, JSON.stringify(incoming, null, 2), 'utf8');

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
  const incoming = JSON.parse(
    await readFile(snapshotPath, 'utf8'),
  ) as OrganizationSnapshot;
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
  await applyOrganizationSelections(prisma, current, snapshot, diff.changes, selections);
}
