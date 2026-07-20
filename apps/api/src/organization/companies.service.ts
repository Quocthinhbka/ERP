import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgCodeService } from './org-code.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/organization.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private orgCode: OrgCodeService,
  ) {}

  async create(dto: CreateCompanyDto) {
    const org = await this.prisma.organization.findFirst();
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const manager = await this.resolveManagerFields(dto.managerUserId, dto.managerName, dto.managerEmployeeCode);
    const code = await this.orgCode.nextCompanyCode(org.id);

    return this.prisma.company.create({
      data: {
        organizationId: org.id,
        code,
        name: dto.name,
        description: dto.description,
        managerName: manager.managerName,
        managerEmployeeCode: manager.managerEmployeeCode,
        managerUserId: manager.managerUserId,
        displayOrder: dto.displayOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    const manager = await this.resolveManagerFields(
      dto.managerUserId ?? undefined,
      dto.managerName,
      dto.managerEmployeeCode,
      dto.managerUserId === null,
    );

    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        displayOrder: dto.displayOrder,
        status: dto.status,
        managerName: manager.managerName,
        managerEmployeeCode: manager.managerEmployeeCode,
        managerUserId: manager.managerUserId,
      },
    });
  }

  async remove(id: string) {
    const company = await this.findOne(id);
    const childCount = await this.prisma.organizationUnit.count({
      where: { companyId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete company with organization units');
    }
    await this.prisma.company.delete({ where: { id: company.id } });
    return { success: true };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  private async resolveManagerFields(
    managerUserId?: string,
    managerName?: string,
    managerEmployeeCode?: string,
    clearLink = false,
  ) {
    if (clearLink) {
      return {
        managerUserId: null,
        managerName: managerName ?? null,
        managerEmployeeCode: managerEmployeeCode ?? null,
      };
    }

    if (managerUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: managerUserId } });
      if (!user) {
        throw new NotFoundException('Manager user not found');
      }
      return {
        managerUserId: user.id,
        managerName: managerName ?? user.fullName,
        managerEmployeeCode: managerEmployeeCode ?? user.employeeCode,
      };
    }

    return {
      managerUserId: null,
      managerName: managerName ?? null,
      managerEmployeeCode: managerEmployeeCode ?? null,
    };
  }
}
