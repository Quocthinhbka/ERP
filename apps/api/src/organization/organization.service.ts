import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async getCurrent() {
    const org = await this.prisma.organization.findFirst({
      include: {
        linkedProfileUser: { select: { id: true, fullName: true } },
        members: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { companies: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return this.toResponse(org);
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
        await tx.organizationMember.deleteMany({ where: { organizationId: org.id } });
        if (dto.members.length > 0) {
          await tx.organizationMember.createMany({
            data: dto.members.map((m, index) => ({
              organizationId: org.id,
              position: m.position,
              memberName: m.memberName,
              phone: m.phone,
              email: m.email,
              additionalInfo: m.additionalInfo,
              sortOrder: index,
            })),
          });
        }
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

  private toResponse(org: {
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
      phone: string | null;
      email: string | null;
      additionalInfo: string | null;
    }>;
    _count: { companies: number };
  }) {
    return {
      id: org.id,
      name: org.name,
      representativeName: org.representativeName,
      linkedProfileUserId: org.linkedProfileUserId,
      linkedProfileName: org.linkedProfileUser?.fullName ?? null,
      additionalInfo: org.additionalInfo,
      members: org.members.map((m) => ({
        id: m.id,
        position: m.position,
        memberName: m.memberName,
        phone: m.phone,
        email: m.email,
        additionalInfo: m.additionalInfo,
      })),
      companyCount: org._count.companies,
    };
  }
}
