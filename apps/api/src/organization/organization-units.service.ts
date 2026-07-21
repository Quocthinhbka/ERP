import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PositionHolderKind } from '@erp/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrganizationUnitDto,
  UnitMemberDto,
  UpdateOrganizationUnitDto,
} from './dto/organization.dto';
import { PositionPermissionsService } from './position-permissions.service';

@Injectable()
export class OrganizationUnitsService {
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
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

    if (dto.linkedProfileUserId) {
      await this.ensureUser(dto.linkedProfileUserId);
    }

    const siblingMax = await this.prisma.organizationUnit.aggregate({
      where: {
        companyId: dto.companyId,
        parentUnitId: dto.parentUnitId ?? null,
      },
      _max: { sortOrder: true },
    });

    const unit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationUnit.create({
        data: {
          companyId: dto.companyId,
          parentUnitId: dto.parentUnitId ?? null,
          name: dto.name,
          managerName: dto.managerName,
          linkedProfileUserId: dto.linkedProfileUserId,
          status: dto.status ?? 'ACTIVE',
          additionalInfo: dto.additionalInfo,
          sortOrder: (siblingMax._max.sortOrder ?? -1) + 1,
        },
      });

      if (dto.positionPermission !== undefined) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.UNIT_MANAGER,
          created.id,
          dto.positionPermission,
          tx,
        );
      }

      return created;
    });

    return this.findOne(unit.id);
  }

  async update(id: string, dto: UpdateOrganizationUnitDto) {
    await this.findOne(id);

    if (dto.linkedProfileUserId) {
      await this.ensureUser(dto.linkedProfileUserId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationUnit.update({
        where: { id },
        data: {
          name: dto.name,
          managerName: dto.managerName,
          linkedProfileUserId: dto.linkedProfileUserId ?? undefined,
          status: dto.status,
          additionalInfo: dto.additionalInfo,
        },
      });

      if (dto.members) {
        await this.syncMembers(tx, id, dto.members);
      }

      if (dto.positionPermission !== undefined) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.UNIT_MANAGER,
          id,
          dto.positionPermission,
          tx,
        );
      }
    });

    return this.findOne(id);
  }

  async reorder(id: string, direction: 'up' | 'down') {
    const unit = await this.prisma.organizationUnit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Organization unit not found');
    }

    const siblings = await this.prisma.organizationUnit.findMany({
      where: {
        companyId: unit.companyId,
        parentUnitId: unit.parentUnitId,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const index = siblings.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException('Unit not found among siblings');
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      throw new BadRequestException(`Cannot move ${direction}`);
    }

    const current = siblings[index];
    const target = siblings[targetIndex];

    await this.prisma.$transaction([
      this.prisma.organizationUnit.update({
        where: { id: current.id },
        data: { sortOrder: target.sortOrder },
      }),
      this.prisma.organizationUnit.update({
        where: { id: target.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return this.findOne(id);
  }

  async remove(id: string) {
    const unit = await this.prisma.organizationUnit.findUnique({
      where: { id },
      include: {
        members: { select: { id: true } },
        _count: { select: { childUnits: true, members: true } },
      },
    });
    if (!unit) {
      throw new NotFoundException('Organization unit not found');
    }

    if (unit._count.childUnits > 0) {
      throw new BadRequestException('Cannot delete unit with child units');
    }
    if (unit._count.members > 0) {
      throw new BadRequestException('Cannot delete unit with employees');
    }

    await this.positionPermissions.deleteByHolder(PositionHolderKind.UNIT_MANAGER, id);
    await this.prisma.organizationUnit.delete({ where: { id } });
    return { success: true };
  }

  async findOne(id: string) {
    const unit = await this.prisma.organizationUnit.findUnique({
      where: { id },
      include: {
        linkedProfileUser: { select: { id: true, fullName: true } },
        members: {
          orderBy: { sortOrder: 'asc' },
          include: { linkedProfileUser: { select: { id: true, fullName: true } } },
        },
        _count: { select: { childUnits: true } },
      },
    });
    if (!unit) {
      throw new NotFoundException('Organization unit not found');
    }

    const isLeaf = unit._count.childUnits === 0;
    const managerPermission = await this.positionPermissions.getPositionPermission(
      PositionHolderKind.UNIT_MANAGER,
      unit.id,
    );
    const memberPermissions = await this.positionPermissions.getManyPositionPermissions(
      unit.members.map((m) => ({
        holderKind: PositionHolderKind.UNIT_MEMBER,
        holderId: m.id,
      })),
    );

    return this.toResponse(unit, isLeaf, managerPermission, memberPermissions);
  }

  private async syncMembers(
    tx: Prisma.TransactionClient,
    unitId: string,
    members: UnitMemberDto[],
  ) {
    const existing = await tx.organizationUnitMember.findMany({
      where: { unitId },
      select: { id: true },
    });
    const keepIds = new Set(members.map((m) => m.id).filter(Boolean) as string[]);
    const toDelete = existing.filter((m) => !keepIds.has(m.id));

    if (toDelete.length > 0) {
      await this.positionPermissions.deleteByHolders(
        toDelete.map((m) => ({
          holderKind: PositionHolderKind.UNIT_MEMBER,
          holderId: m.id,
        })),
        tx,
      );
      await tx.organizationUnitMember.deleteMany({
        where: { id: { in: toDelete.map((m) => m.id) } },
      });
    }

    for (const [index, member] of members.entries()) {
      if (member.linkedProfileUserId) {
        await this.ensureUser(member.linkedProfileUserId);
      }

      let memberId = member.id;
      if (memberId && keepIds.has(memberId)) {
        await tx.organizationUnitMember.update({
          where: { id: memberId },
          data: {
            position: member.position,
            memberName: member.memberName,
            linkedProfileUserId: member.linkedProfileUserId,
            phone: member.phone,
            email: member.email,
            additionalInfo: member.additionalInfo,
            sortOrder: index,
          },
        });
      } else {
        const created = await tx.organizationUnitMember.create({
          data: {
            unitId,
            position: member.position,
            memberName: member.memberName,
            linkedProfileUserId: member.linkedProfileUserId,
            phone: member.phone,
            email: member.email,
            additionalInfo: member.additionalInfo,
            sortOrder: index,
          },
        });
        memberId = created.id;
      }

      if (member.positionPermission !== undefined && memberId) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.UNIT_MEMBER,
          memberId,
          member.positionPermission,
          tx,
        );
      }
    }
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Linked profile user not found');
    }
  }

  private toResponse(
    unit: {
      id: string;
      companyId: string;
      parentUnitId: string | null;
      name: string;
      managerName: string | null;
      linkedProfileUserId: string | null;
      status: string;
      additionalInfo: string | null;
      linkedProfileUser: { id: string; fullName: string } | null;
      members: Array<{
        id: string;
        position: string;
        memberName: string;
        linkedProfileUserId: string | null;
        phone: string | null;
        email: string | null;
        additionalInfo: string | null;
        linkedProfileUser: { fullName: string } | null;
      }>;
    },
    isLeaf: boolean,
    positionPermission: Awaited<
      ReturnType<PositionPermissionsService['getPositionPermission']>
    >,
    memberPermissions: Map<string, NonNullable<
      Awaited<ReturnType<PositionPermissionsService['getPositionPermission']>>
    >>,
  ) {
    return {
      id: unit.id,
      companyId: unit.companyId,
      parentUnitId: unit.parentUnitId,
      name: unit.name,
      managerName: unit.managerName,
      linkedProfileUserId: unit.linkedProfileUserId,
      linkedProfileName: unit.linkedProfileUser?.fullName ?? null,
      status: unit.status,
      additionalInfo: unit.additionalInfo,
      isLeaf,
      positionPermission,
      members: unit.members.map((m) => ({
        id: m.id,
        position: m.position,
        memberName: m.memberName,
        linkedProfileUserId: m.linkedProfileUserId,
        linkedProfileName: m.linkedProfileUser?.fullName ?? null,
        phone: m.phone,
        email: m.email,
        additionalInfo: m.additionalInfo,
        positionPermission:
          memberPermissions.get(`${PositionHolderKind.UNIT_MEMBER}:${m.id}`) ?? null,
      })),
    };
  }
}
