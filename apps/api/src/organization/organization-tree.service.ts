import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EntityStatus,
  OrgMember,
  OrgNodeType,
  OrgScopeNode,
  OrgTreeNode,
  PositionHolderKind,
} from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PositionPermissionsService } from './position-permissions.service';

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
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async getTree(
    search?: string,
    scope?: { isSystemAdmin: boolean; orgScopes: OrgScopeNode[] },
  ) {
    const org = await this.prisma.organization.findFirst({
      include: {
        linkedProfileUser: { select: { fullName: true } },
        members: {
          orderBy: { sortOrder: 'asc' },
          include: { linkedProfileUser: { select: { fullName: true } } },
        },
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

    const holders: Array<{ holderKind: PositionHolderKind; holderId: string }> = [
      { holderKind: PositionHolderKind.ORGANIZATION_REP, holderId: org.id },
    ];
    for (const company of org.companies) {
      holders.push({ holderKind: PositionHolderKind.COMPANY_REP, holderId: company.id });
      for (const unit of company.units) {
        holders.push({ holderKind: PositionHolderKind.UNIT_MANAGER, holderId: unit.id });
        for (const member of unit.members) {
          holders.push({ holderKind: PositionHolderKind.UNIT_MEMBER, holderId: member.id });
        }
      }
    }
    const permissionMap =
      await this.positionPermissions.getManyPositionPermissions(holders);

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
      positionPermission:
        permissionMap.get(`${PositionHolderKind.ORGANIZATION_REP}:${org.id}`) ?? null,
      members: org.members.map((m) => this.mapLinkedMember(m)),
      childCount: org.companies.length,
      children: org.companies.map((company) => {
        const unitTree = this.buildUnitTree(
          company.units as UnitRow[],
          null,
          permissionMap,
        );
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
          positionPermission:
            permissionMap.get(`${PositionHolderKind.COMPANY_REP}:${company.id}`) ?? null,
          members: company.members.map((m) => this.mapLinkedMember(m)),
          organizationId: org.id,
          childCount: unitTree.length,
          children: unitTree,
        };
        this.collectMatches(companyNode, normalizedSearch, matchedKeys);
        return companyNode;
      }),
    };

    this.collectMatches(orgNode, normalizedSearch, matchedKeys);

    const filtered =
      scope != null
        ? this.positionPermissions.filterTreeByScope(
            orgNode,
            scope.isSystemAdmin,
            scope.orgScopes,
          )
        : orgNode;

    if (scope != null && !scope.isSystemAdmin && filtered == null) {
      throw new ForbiddenException('Outside permitted organization scope');
    }

    return {
      tree: filtered ?? orgNode,
      matchedKeys: Array.from(matchedKeys),
    };
  }

  private buildUnitTree(
    units: UnitRow[],
    parentUnitId: string | null,
    permissionMap: Map<string, NonNullable<
      Awaited<ReturnType<PositionPermissionsService['getPositionPermission']>>
    >>,
  ): OrgTreeNode[] {
    return units
      .filter((u) => u.parentUnitId === parentUnitId)
      .map((unit) => {
        const children = this.buildUnitTree(units, unit.id, permissionMap);
        const isLeaf = unit._count.childUnits === 0;
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
          childCount: children.length,
          isLeaf,
          positionPermission:
            permissionMap.get(`${PositionHolderKind.UNIT_MANAGER}:${unit.id}`) ?? null,
          members: unit.members.map((m) => ({
            ...this.mapLinkedMember(m),
            positionPermission: isLeaf
              ? permissionMap.get(`${PositionHolderKind.UNIT_MEMBER}:${m.id}`) ?? null
              : null,
          })),
          children,
        };
      });
  }

  private mapLinkedMember(member: {
    id: string;
    position: string;
    memberName: string;
    phone: string | null;
    email: string | null;
    additionalInfo: string | null;
    linkedProfileUserId?: string | null;
    linkedProfileUser?: { fullName: string } | null;
  }): OrgMember {
    return {
      id: member.id,
      position: member.position,
      memberName: member.memberName,
      phone: member.phone,
      email: member.email,
      additionalInfo: member.additionalInfo,
      linkedProfileUserId: member.linkedProfileUserId ?? null,
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
