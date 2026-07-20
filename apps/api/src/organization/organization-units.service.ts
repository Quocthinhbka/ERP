import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgCodeService } from './org-code.service';
import {
  CreateOrganizationUnitDto,
  MoveOrganizationUnitDto,
  UpdateOrganizationUnitDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationUnitsService {
  constructor(
    private prisma: PrismaService,
    private orgCode: OrgCodeService,
  ) {}

  async create(dto: CreateOrganizationUnitDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (dto.parentUnitId) {
      const parent = await this.prisma.organizationUnit.findUnique({
        where: { id: dto.parentUnitId },
      });
      if (!parent || parent.companyId !== dto.companyId) {
        throw new BadRequestException('Parent unit must belong to the same company');
      }
    }

    const manager = await this.resolveManagerFields(dto.managerUserId, dto.managerName, dto.managerEmployeeCode);
    const code = await this.orgCode.nextUnitCode(company.id, company.code);

    return this.prisma.organizationUnit.create({
      data: {
        companyId: dto.companyId,
        parentUnitId: dto.parentUnitId ?? null,
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

  async update(id: string, dto: UpdateOrganizationUnitDto) {
    await this.findOne(id);
    const manager = await this.resolveManagerFields(
      dto.managerUserId ?? undefined,
      dto.managerName,
      dto.managerEmployeeCode,
      dto.managerUserId === null,
    );

    return this.prisma.organizationUnit.update({
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

  async move(id: string, dto: MoveOrganizationUnitDto) {
    const unit = await this.findOne(id);

    if (dto.parentUnitId === id) {
      throw new BadRequestException('Unit cannot be its own parent');
    }

    if (dto.parentUnitId) {
      const parent = await this.prisma.organizationUnit.findUnique({
        where: { id: dto.parentUnitId },
      });
      if (!parent || parent.companyId !== unit.companyId) {
        throw new BadRequestException('Parent unit must belong to the same company');
      }
      const descendants = await this.getDescendantIds(id);
      if (descendants.includes(dto.parentUnitId)) {
        throw new BadRequestException('Cannot move unit into its descendant');
      }
    }

    return this.prisma.organizationUnit.update({
      where: { id },
      data: {
        parentUnitId: dto.parentUnitId ?? null,
        displayOrder: dto.displayOrder ?? unit.displayOrder,
      },
    });
  }

  async remove(id: string) {
    const unit = await this.findOne(id);
    const childCount = await this.prisma.organizationUnit.count({
      where: { parentUnitId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete unit with child units');
    }
    await this.prisma.organizationUnit.delete({ where: { id: unit.id } });
    return { success: true };
  }

  async findOne(id: string) {
    const unit = await this.prisma.organizationUnit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Organization unit not found');
    }
    return unit;
  }

  async getDescendantIds(unitId: string): Promise<string[]> {
    const children = await this.prisma.organizationUnit.findMany({
      where: { parentUnitId: unitId },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...(await this.getDescendantIds(child.id)));
    }
    return ids;
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
