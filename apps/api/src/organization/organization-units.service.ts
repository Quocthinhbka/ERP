import {

  BadRequestException,

  Injectable,

  NotFoundException,

} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {

  CreateOrganizationUnitDto,

  UnitMemberDto,

  UpdateOrganizationUnitDto,

} from './dto/organization.dto';



@Injectable()

export class OrganizationUnitsService {

  constructor(private prisma: PrismaService) {}



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



    const unit = await this.prisma.organizationUnit.create({

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

      include: {

        linkedProfileUser: { select: { id: true, fullName: true } },

        members: {

          orderBy: { sortOrder: 'asc' },

          include: { linkedProfileUser: { select: { id: true, fullName: true } } },

        },

      },

    });



    return this.toResponse(unit);

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

        await tx.organizationUnitMember.deleteMany({ where: { unitId: id } });

        if (dto.members.length > 0) {

          await this.createMembers(tx, id, dto.members);

        }

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

      include: { _count: { select: { childUnits: true, members: true } } },

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

      },

    });

    if (!unit) {

      throw new NotFoundException('Organization unit not found');

    }

    return this.toResponse(unit);

  }



  private async createMembers(

    tx: Prisma.TransactionClient,

    unitId: string,

    members: UnitMemberDto[],

  ) {

    for (const [index, member] of members.entries()) {

      if (member.linkedProfileUserId) {

        await this.ensureUser(member.linkedProfileUserId);

      }

      await tx.organizationUnitMember.create({

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

    }

  }



  private async ensureUser(userId: string) {

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {

      throw new NotFoundException('Linked profile user not found');

    }

  }



  private toResponse(unit: {

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

  }) {

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

      members: unit.members.map((m) => ({

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

}


