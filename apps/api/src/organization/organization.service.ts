import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async getCurrent() {
    const org = await this.prisma.organization.findFirst({
      include: { _count: { select: { companies: true } } },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return {
      id: org.id,
      code: org.code,
      name: org.name,
      description: org.description,
      status: org.status,
      companyCount: org._count.companies,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async update(dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst();
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: dto,
    });
    return updated;
  }
}
