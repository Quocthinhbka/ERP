import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityStatus, OrgMember, OrgNodeType, OrgTreeNode } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';

type UnitRow = {
  id: string;
  companyId: string;
  parentUnitId: string | null;
  name: string;
  managerName: string | null;
  linkedProfileUserId: string | null;
  status: EntityStatus;
  additionalInfo: string | null;
  linkedProfileUser: { fullName: string } | null;
  members: Array<{
    id: string;
    position: string;
    memberName: string;
    phone: string | null;
    email: string | null;
    additionalInfo: string | null;
    linkedProfileUserId: string | null;
    linkedProfileUser: { fullName: string } | null;
  }>;
  _count: { childUnits: number };
};

@Injectable()
export class OrganizationTreeService {
  constructor(private prisma: PrismaService) {}

  async getTree(search?: string) {
    const org = await this.prisma.organization.findFirst({
      include: {
        linkedProfileUser: { select: { fullName: true } },
        members: { orderBy: { sortOrder: 'asc' } },
        companies: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            linkedProfileUser: { select: { fullName: true } },
            members: {
              orderBy: { sortOrder: 'asc' },
              include: { linkedProfileUser: { select: { fullName: true } } },
            },
            units: {
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              include: {
                linkedProfileUser: { select: { fullName: true } },
                members: {
                  orderBy: { sortOrder: 'asc' },
                  include: { linkedProfileUser: { select: { fullName: true } } },
                },
                _count: { select: { childUnits: true } },
              },
            },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const normalizedSearch = search?.trim().toLowerCase();
    const matchedKeys = new Set<string>();

    const orgNode: OrgTreeNode = {
      id: org.id,
      type: OrgNodeType.ORGANIZATION,
      name: org.name,
      representativeName: org.representativeName,
      linkedProfileUserId: org.linkedProfileUserId,
      linkedProfileName: org.linkedProfileUser?.fullName ?? null,
      additionalInfo: org.additionalInfo,
      members: org.members.map((m) => this.mapOrgMember(m)),
      childCount: org.companies.length,
      children: org.companies.map((company) => {
        const unitTree = this.buildUnitTree(company.units as UnitRow[], null);
        const companyNode: OrgTreeNode = {
          id: company.id,
          type: OrgNodeType.COMPANY,
          name: company.name,
          representativeName: company.representativeName,
          linkedProfileUserId: company.linkedProfileUserId,
          linkedProfileName: company.linkedProfileUser?.fullName ?? null,
          taxId: company.taxId,
          address: company.address,
          phone: company.phone,
          email: company.email,
          status: company.status as EntityStatus,
          members: company.members.map((m) => this.mapCompanyMember(m)),
          organizationId: org.id,
          childCount: company.units.length,
          children: unitTree,
        };
        this.collectMatches(companyNode, normalizedSearch, matchedKeys);
        return companyNode;
      }),
    };

    this.collectMatches(orgNode, normalizedSearch, matchedKeys);

    return {
      tree: orgNode,
      matchedKeys: Array.from(matchedKeys),
    };
  }

  private buildUnitTree(units: UnitRow[], parentUnitId: string | null): OrgTreeNode[] {
    return units
      .filter((u) => u.parentUnitId === parentUnitId)
      .map((unit) => {
        const children = this.buildUnitTree(units, unit.id);
        return {
          id: unit.id,
          type: OrgNodeType.UNIT,
          name: unit.name,
          managerName: unit.managerName,
          linkedProfileUserId: unit.linkedProfileUserId,
          linkedProfileName: unit.linkedProfileUser?.fullName ?? null,
          status: unit.status,
          additionalInfo: unit.additionalInfo,
          companyId: unit.companyId,
          parentUnitId: unit.parentUnitId,
          childCount: unit._count.childUnits,
          members: unit.members.map((m) => this.mapCompanyMember(m)),
          children,
        };
      });
  }

  private mapOrgMember(member: {
    id: string;
    position: string;
    memberName: string;
    phone: string | null;
    email: string | null;
    additionalInfo: string | null;
  }): OrgMember {
    return {
      id: member.id,
      position: member.position,
      memberName: member.memberName,
      phone: member.phone,
      email: member.email,
      additionalInfo: member.additionalInfo,
    };
  }

  private mapCompanyMember(member: {
    id: string;
    position: string;
    memberName: string;
    phone: string | null;
    email: string | null;
    additionalInfo: string | null;
    linkedProfileUserId: string | null;
    linkedProfileUser: { fullName: string } | null;
  }): OrgMember {
    return {
      id: member.id,
      position: member.position,
      memberName: member.memberName,
      phone: member.phone,
      email: member.email,
      additionalInfo: member.additionalInfo,
      linkedProfileUserId: member.linkedProfileUserId,
      linkedProfileName: member.linkedProfileUser?.fullName ?? null,
    };
  }

  private collectMatches(node: OrgTreeNode, search: string | undefined, matchedKeys: Set<string>) {
    const nodeKey = `${node.type}:${node.id}`;
    const haystack = [
      node.name,
      node.representativeName ?? '',
      node.managerName ?? '',
      node.linkedProfileName ?? '',
      node.taxId ?? '',
      node.phone ?? '',
      node.email ?? '',
      ...(node.members?.flatMap((m) => [m.memberName, m.position, m.email ?? '', m.phone ?? '']) ?? []),
    ]
      .join(' ')
      .toLowerCase();

    if (search && haystack.includes(search)) {
      matchedKeys.add(nodeKey);
    }

    for (const child of node.children) {
      this.collectMatches(child, search, matchedKeys);
      if (matchedKeys.has(`${child.type}:${child.id}`)) {
        matchedKeys.add(nodeKey);
      }
    }
  }
}
