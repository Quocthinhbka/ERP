import { Injectable, NotFoundException } from '@nestjs/common';
import { PositionHolderKind } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/organization.dto';
import { PositionPermissionsService } from './position-permissions.service';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async getCurrent() {
    const org = await this.prisma.organization.findFirst({
      include: {
        linkedProfileUser: { select: { id: true, fullName: true } },
        members: {
          orderBy: { sortOrder: 'asc' },
          include: { linkedProfileUser: { select: { id: true, fullName: true } } },
        },
        _count: { select: { companies: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const positionPermission = await this.positionPermissions.getPositionPermission(
      PositionHolderKind.ORGANIZATION_REP,
      org.id,
    );
    return this.toResponse(org, positionPermission);
  }

  async update(dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst();
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.linkedProfileUserId) {
      await this.ensureUser(dto.linkedProfileUserId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: org.id },
        data: {
          name: dto.name,
          representativeName: dto.representativeName,
          linkedProfileUserId: dto.linkedProfileUserId ?? undefined,
          additionalInfo: dto.additionalInfo,
        },
      });

      if (dto.members) {
        for (const member of dto.members) {
          if (member.linkedProfileUserId) {
            await this.ensureUser(member.linkedProfileUserId);
          }
        }
        await tx.organizationMember.deleteMany({ where: { organizationId: org.id } });
        if (dto.members.length > 0) {
          for (const [index, m] of dto.members.entries()) {
            await tx.organizationMember.create({
              data: {
                organizationId: org.id,
                position: m.position,
                memberName: m.memberName,
                linkedProfileUserId: m.linkedProfileUserId,
                phone: m.phone,
                email: m.email,
                additionalInfo: m.additionalInfo,
                sortOrder: index,
              },
            });
          }
        }
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
      _count: { companies: number };
    },
    positionPermission: Awaited<
      ReturnType<PositionPermissionsService['getPositionPermission']>
    >,
  ) {
    return {
      id: org.id,
      name: org.name,
      representativeName: org.representativeName,
      linkedProfileUserId: org.linkedProfileUserId,
      linkedProfileName: org.linkedProfileUser?.fullName ?? null,
      additionalInfo: org.additionalInfo,
      positionPermission,
      members: org.members.map((m) => ({
        id: m.id,
        position: m.position,
        memberName: m.memberName,
        linkedProfileUserId: m.linkedProfileUserId,
        linkedProfileName: m.linkedProfileUser?.fullName ?? null,
        phone: m.phone,
        email: m.email,
        additionalInfo: m.additionalInfo,
      })),
      companyCount: org._count.companies,
    };
  }
}
