import { formatPositionCode } from '@erp/shared';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Sinh mã vị trí tiếp theo VT-00001 (sequence DB). */
export async function allocatePositionCode(tx: Tx): Promise<string> {
  const [row] = await tx.$queryRaw<Array<{ seq: bigint }>>`
    SELECT nextval('org_position_code_seq') AS seq
  `;
  return formatPositionCode(Number(row.seq));
}
