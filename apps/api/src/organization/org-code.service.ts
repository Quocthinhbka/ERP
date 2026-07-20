import { Injectable } from '@nestjs/common';
import { formatCompanyCode, formatUnitCode } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrgCodeService {
  constructor(private prisma: PrismaService) {}

  async nextCompanyCode(organizationId: string): Promise<string> {
    const companies = await this.prisma.company.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const sequences = companies
      .map((c) => /^C(\d+)$/.exec(c.code)?.[1])
      .filter((v): v is string => !!v)
      .map(Number);
    const next = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
    return formatCompanyCode(next);
  }

  async nextUnitCode(companyId: string, companyCode: string): Promise<string> {
    const units = await this.prisma.organizationUnit.findMany({
      where: { companyId },
      select: { code: true },
    });
    const prefix = `${companyCode}-`;
    const sequences = units
      .map((u) => u.code.startsWith(prefix) ? u.code.slice(prefix.length) : null)
      .filter((v): v is string => !!v && /^\d+$/.test(v))
      .map(Number);
    const next = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
    return formatUnitCode(companyCode, next);
  }
}
