import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PositionHolderKind } from '@erp/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyMemberDto, CreateCompanyDto, UpdateCompanyDto } from './dto/organization.dto';
import { PositionPermissionsService } from './position-permissions.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async create(dto: CreateCompanyDto) {
    const org = await this.prisma.organization.findFirst();
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.linkedProfileUserId) {
      await this.ensureUser(dto.linkedProfileUserId);
    }

    const siblingMax = await this.prisma.company.aggregate({
      where: { organizationId: org.id },
      _max: { sortOrder: true },
    });

    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          organizationId: org.id,
          name: dto.name,
          taxId: dto.taxId,
          address: dto.address,
          representativeName: dto.representativeName,
          linkedProfileUserId: dto.linkedProfileUserId,
          phone: dto.phone,
          email: dto.email,
          status: dto.status ?? 'ACTIVE',
          sortOrder: (siblingMax._max.sortOrder ?? -1) + 1,
        },
      });

      if (dto.members?.length) {
        await this.createMembers(tx, created.id, dto.members);
      }

      if (dto.positionPermission !== undefined) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.COMPANY_REP,
          created.id,
          dto.positionPermission,
          tx,
        );
      }

      return created;
    });

    return this.findOne(company.id);
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);

    if (dto.linkedProfileUserId) {
      await this.ensureUser(dto.linkedProfileUserId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: {
          name: dto.name,
          taxId: dto.taxId,
          address: dto.address,
          representativeName: dto.representativeName,
          linkedProfileUserId: dto.linkedProfileUserId ?? undefined,
          phone: dto.phone,
          email: dto.email,
          status: dto.status,
        },
      });

      if (dto.members) {
        await tx.companyMember.deleteMany({ where: { companyId: id } });
        if (dto.members.length > 0) {
          await this.createMembers(tx, id, dto.members);
        }
      }

      if (dto.positionPermission !== undefined) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.COMPANY_REP,
          id,
          dto.positionPermission,
          tx,
        );
      }
    });

    return this.findOne(id);
  }

  async reorder(id: string, direction: 'up' | 'down') {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const siblings = await this.prisma.company.findMany({
      where: { organizationId: company.organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const index = siblings.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException('Company not found among siblings');
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      throw new BadRequestException(`Cannot move ${direction}`);
    }

    const current = siblings[index];
    const target = siblings[targetIndex];

    await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id: current.id },
        data: { sortOrder: target.sortOrder },
      }),
      this.prisma.company.update({
        where: { id: target.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return this.findOne(id);
  }

  async remove(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const childCount = await this.prisma.organizationUnit.count({
      where: { companyId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete company with organization units');
    }

    await this.positionPermissions.deleteByHolder(PositionHolderKind.COMPANY_REP, id);
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        linkedProfileUser: { select: { id: true, fullName: true } },
        members: {
          orderBy: { sortOrder: 'asc' },
          include: { linkedProfileUser: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    const positionPermission = await this.positionPermissions.getPositionPermission(
      PositionHolderKind.COMPANY_REP,
      company.id,
    );
    return {
      id: company.id,
      organizationId: company.organizationId,
      name: company.name,
      taxId: company.taxId,
      address: company.address,
      representativeName: company.representativeName,
      linkedProfileUserId: company.linkedProfileUserId,
      linkedProfileName: company.linkedProfileUser?.fullName ?? null,
      phone: company.phone,
      email: company.email,
      status: company.status,
      positionPermission,
      members: company.members.map((m) => ({
        id: m.id,
        position: m.position,
        memberName: m.memberName,
        linkedProfileUserId: m.linkedProfileUserId,
        linkedProfileName: m.linkedProfileUser?.fullName ?? null,
        phone: m.phone,
        email: m.email,
        additionalInfo: m.additionalInfo,
      })),
    };
  }

  private async createMembers(
    tx: Prisma.TransactionClient,
    companyId: string,
    members: CompanyMemberDto[],
  ) {
    for (const [index, member] of members.entries()) {
      if (member.linkedProfileUserId) {
        await this.ensureUser(member.linkedProfileUserId);
      }
      await tx.companyMember.create({
        data: {
          companyId,
          position: member.position,
          memberName: member.memberName,
          linkedProfileUserId: member.linkedProfileUserId,
          phone: member.phone,
          email: member.email,
          additionalInfo: member.additionalInfo,
          sortOrder: index,
        },
      });
    }
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Linked profile user not found');
    }
  }
}
