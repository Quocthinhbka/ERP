import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityStatus, OrgNodeType, OrgTreeNode } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';

type UnitRow = {
  id: string;
  companyId: string;
  parentUnitId: string | null;
  code: string;
  name: string;
  description: string | null;
  managerName: string | null;
  managerEmployeeCode: string | null;
  managerUserId: string | null;
  displayOrder: number;
  status: EntityStatus;
  _count: { childUnits: number };
};

@Injectable()
export class OrganizationTreeService {
  constructor(private prisma: PrismaService) {}

  async getTree(search?: string) {
    const org = await this.prisma.organization.findFirst({
      include: {
        companies: {
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          include: {
            units: {
              orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
              include: { _count: { select: { childUnits: true } } },
            },
            _count: { select: { units: true } },
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
      code: org.code,
      name: org.name,
      description: org.description,
      status: org.status as EntityStatus,
      displayOrder: 0,
      childCount: org.companies.length,
      children: org.companies.map((company) => {
        const unitTree = this.buildUnitTree(company.units as UnitRow[], null);
        const companyNode: OrgTreeNode = {
          id: company.id,
          type: OrgNodeType.COMPANY,
          code: company.code,
          name: company.name,
          description: company.description,
          status: company.status as EntityStatus,
          managerName: company.managerName,
          managerEmployeeCode: company.managerEmployeeCode,
          managerUserId: company.managerUserId,
          displayOrder: company.displayOrder,
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
          code: unit.code,
          name: unit.name,
          description: unit.description,
          status: unit.status,
          managerName: unit.managerName,
          managerEmployeeCode: unit.managerEmployeeCode,
          managerUserId: unit.managerUserId,
          displayOrder: unit.displayOrder,
          companyId: unit.companyId,
          parentUnitId: unit.parentUnitId,
          childCount: unit._count.childUnits,
          children,
        };
      });
  }

  private collectMatches(node: OrgTreeNode, search: string | undefined, matchedKeys: Set<string>) {
    const nodeKey = `${node.type}:${node.id}`;
    const haystack = [
      node.name,
      node.code,
      node.managerName ?? '',
      node.managerEmployeeCode ?? '',
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
