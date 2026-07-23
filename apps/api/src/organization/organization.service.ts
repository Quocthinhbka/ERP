import { Injectable, NotFoundException } from '@nestjs/common';
import { PositionHolderKind } from '@erp/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrganizationMemberDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { allocatePositionCode } from './position-code.util';
import { PositionPermissionsService } from './position-permissions.service';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async getCurrent() {
    const org = await this.ensureOrganization();
    const positionPermission = await this.positionPermissions.getPositionPermission(
      PositionHolderKind.ORGANIZATION_REP,
      org.id,
    );
    const memberPermissions =
      await this.positionPermissions.getManyPositionPermissions(
        org.members.map((m) => ({
          holderKind: PositionHolderKind.ORGANIZATION_MEMBER,
          holderId: m.id,
        })),
      );
    return this.toResponse(org, positionPermission, memberPermissions);
  }

  async update(dto: UpdateOrganizationDto) {
    const org = await this.ensureOrganization();

    if (dto.linkedProfileUserId) {
      await this.ensureUser(dto.linkedProfileUserId);
    }

    await this.prisma.$transaction(async (tx) => {
      const positionCode =
        org.positionCode ?? (await allocatePositionCode(tx));
      await tx.organization.update({
        where: { id: org.id },
        data: {
          name: dto.name,
          representativeName: dto.representativeName,
          linkedProfileUserId: dto.linkedProfileUserId ?? undefined,
          additionalInfo: dto.additionalInfo,
          positionCode,
        },
      });

      if (dto.members) {
        await this.syncMembers(tx, org.id, dto.members);
      }

      if (dto.positionPermission !== undefined) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.ORGANIZATION_REP,
          org.id,
          dto.positionPermission,
          tx,
        );
      }
    });

    return this.getCurrent();
  }

  private async syncMembers(
    tx: Prisma.TransactionClient,
    organizationId: string,
    members: OrganizationMemberDto[],
  ) {
    const existing = await tx.organizationMember.findMany({
      where: { organizationId },
      select: { id: true, positionCode: true },
    });
    const keepIds = new Set(members.map((m) => m.id).filter(Boolean) as string[]);
    const toDelete = existing.filter((m) => !keepIds.has(m.id));

    if (toDelete.length > 0) {
      await this.positionPermissions.deleteByHolders(
        toDelete.map((m) => ({
          holderKind: PositionHolderKind.ORGANIZATION_MEMBER,
          holderId: m.id,
        })),
        tx,
      );
      await tx.organizationMember.deleteMany({
        where: { id: { in: toDelete.map((m) => m.id) } },
      });
    }

    for (const [index, member] of members.entries()) {
      if (member.linkedProfileUserId) {
        await this.ensureUser(member.linkedProfileUserId);
      }

      let memberId = member.id;
      if (memberId && keepIds.has(memberId)) {
        await tx.organizationMember.update({
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
        const created = await tx.organizationMember.create({
          data: {
            organizationId,
            position: member.position,
            memberName: member.memberName,
            linkedProfileUserId: member.linkedProfileUserId,
            phone: member.phone,
            email: member.email,
            additionalInfo: member.additionalInfo,
            sortOrder: index,
            positionCode: await allocatePositionCode(tx),
          },
        });
        memberId = created.id;
      }

      if (member.positionPermission !== undefined && memberId) {
        await this.positionPermissions.upsertPositionPermission(
          PositionHolderKind.ORGANIZATION_MEMBER,
          memberId,
          member.positionPermission,
          tx,
        );
      }
    }
  }

  /** Singleton tổ chức — tạo rỗng nếu chưa có (thay seed). */
  private async ensureOrganization() {
    const existing = await this.prisma.organization.findFirst({
      include: {
        linkedProfileUser: { select: { id: true, fullName: true } },
        members: {
          orderBy: { sortOrder: 'asc' },
          include: { linkedProfileUser: { select: { id: true, fullName: true } } },
        },
        _count: { select: { companies: true } },
      },
    });
    if (existing) {
      if (!existing.positionCode) {
        const code = await this.prisma.$transaction((tx) =>
          allocatePositionCode(tx),
        );
        return this.prisma.organization.update({
          where: { id: existing.id },
          data: { positionCode: code },
          include: {
            linkedProfileUser: { select: { id: true, fullName: true } },
            members: {
              orderBy: { sortOrder: 'asc' },
              include: {
                linkedProfileUser: { select: { id: true, fullName: true } },
              },
            },
            _count: { select: { companies: true } },
          },
        });
      }
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const code = await allocatePositionCode(tx);
      return tx.organization.create({
        data: { name: 'Tổ chức', positionCode: code },
        include: {
          linkedProfileUser: { select: { id: true, fullName: true } },
          members: {
            orderBy: { sortOrder: 'asc' },
            include: {
              linkedProfileUser: { select: { id: true, fullName: true } },
            },
          },
          _count: { select: { companies: true } },
        },
      });
    });
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Linked profile user not found');
    }
  }

  private toResponse(
    org: {
      id: string;
      name: string;
      representativeName: string | null;
      linkedProfileUserId: string | null;
      positionCode: string | null;
      additionalInfo: string | null;
      linkedProfileUser: { id: string; fullName: string } | null;
      members: Array<{
        id: string;
        position: string;
        memberName: string;
        linkedProfileUserId: string | null;
        positionCode: string | null;
        phone: string | null;
        email: string | null;
        additionalInfo: string | null;
        linkedProfileUser: { fullName: string } | null;
      }>;
      _count: { companies: number };
    },
    positionPermission: Awaited<
      ReturnType<PositionPermissionsService['getPositionPermission']>
    >,
    memberPermissions: Map<
      string,
      NonNullable<
        Awaited<ReturnType<PositionPermissionsService['getPositionPermission']>>
      >
    >,
  ) {
    return {
      id: org.id,
      name: org.name,
      representativeName: org.representativeName,
      linkedProfileUserId: org.linkedProfileUserId,
      linkedProfileName: org.linkedProfileUser?.fullName ?? null,
      positionCode: org.positionCode,
      additionalInfo: org.additionalInfo,
      positionPermission,
      members: org.members.map((m) => ({
        id: m.id,
        position: m.position,
        memberName: m.memberName,
        linkedProfileUserId: m.linkedProfileUserId,
        linkedProfileName: m.linkedProfileUser?.fullName ?? null,
        positionCode: m.positionCode,
        phone: m.phone,
        email: m.email,
        additionalInfo: m.additionalInfo,
        positionPermission:
          memberPermissions.get(
            `${PositionHolderKind.ORGANIZATION_MEMBER}:${m.id}`,
          ) ?? null,
      })),
      companyCount: org._count.companies,
    };
  }
}
