import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  OrgNodeType,
  OrgScopeNode,
  PermissionCode,
  PositionHolderKind,
  PositionPermissionSummary,
  ALL_PERMISSIONS,
  hasOrgScopeAccess,
  orgScopeKey,
} from '@erp/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PositionPermissionInput {
  permissionGroupId?: string | null;
  permissionGroupVersionId?: string | null;
  permissionIds?: string[];
  includeSelf?: boolean;
  parentScopes?: OrgScopeNode[];
}

const versionInclude = {
  permissions: { include: { permission: true } },
} as const;

@Injectable()
export class PositionPermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PositionPermissionsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const removed = await this.reconcileOrphans();
      if (removed > 0) {
        this.logger.warn(`Removed ${removed} orphan position permission(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to reconcile orphan position permissions', error as Error);
    }
  }

  /**
   * Xoá các PositionPermission có holder (polymorphic) không còn tồn tại.
   * Bù cho việc holderId không có FK thật.
   */
  async reconcileOrphans(): Promise<number> {
    const rows = await this.prisma.positionPermission.findMany({
      select: { id: true, holderKind: true, holderId: true },
    });
    if (rows.length === 0) return 0;

    const idsByKind = new Map<PositionHolderKind, Set<string>>();
    for (const row of rows) {
      const set = idsByKind.get(row.holderKind) ?? new Set<string>();
      set.add(row.holderId);
      idsByKind.set(row.holderKind, set);
    }

    const existingByKind = async (
      kind: PositionHolderKind,
      ids: string[],
    ): Promise<Set<string>> => {
      const where = { id: { in: ids } } as const;
      const select = { id: true } as const;
      switch (kind) {
        case PositionHolderKind.ORGANIZATION_REP:
          return new Set(
            (await this.prisma.organization.findMany({ where, select })).map((r) => r.id),
          );
        case PositionHolderKind.COMPANY_REP:
          return new Set(
            (await this.prisma.company.findMany({ where, select })).map((r) => r.id),
          );
        case PositionHolderKind.UNIT_MANAGER:
          return new Set(
            (await this.prisma.organizationUnit.findMany({ where, select })).map((r) => r.id),
          );
        case PositionHolderKind.UNIT_MEMBER:
          return new Set(
            (await this.prisma.organizationUnitMember.findMany({ where, select })).map(
              (r) => r.id,
            ),
          );
        case PositionHolderKind.ORGANIZATION_MEMBER:
          return new Set(
            (await this.prisma.organizationMember.findMany({ where, select })).map((r) => r.id),
          );
        case PositionHolderKind.COMPANY_MEMBER:
          return new Set(
            (await this.prisma.companyMember.findMany({ where, select })).map((r) => r.id),
          );
      }
    };

    const orphanIds: string[] = [];
    for (const [kind, idSet] of idsByKind) {
      const ids = [...idSet];
      const existing = await existingByKind(kind, ids);
      for (const row of rows) {
        if (row.holderKind === kind && !existing.has(row.holderId)) {
          orphanIds.push(row.id);
        }
      }
    }

    if (orphanIds.length === 0) return 0;
    await this.prisma.positionPermission.deleteMany({
      where: { id: { in: orphanIds } },
    });
    return orphanIds.length;
  }

  async resolveAuthContext(userId: string): Promise<{
    permissions: PermissionCode[];
    isSystemAdmin: boolean;
    orgScopes: OrgScopeNode[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isSystemAdmin = user.isSuperAdmin;
    if (isSystemAdmin) {
      return {
        permissions: [...ALL_PERMISSIONS],
        isSystemAdmin: true,
        orgScopes: [],
      };
    }

    // Quyền hiệu lực chỉ từ nhóm quyền gắn vị trí trên cây tổ chức.
    // Tài khoản / hồ sơ nhân viên không phải nguồn quyền (trừ Super Admin).
    const codes = new Set<PermissionCode>();

    const holders = await this.findHoldersForUser(userId);
    if (holders.length === 0) {
      return {
        permissions: [],
        isSystemAdmin: false,
        orgScopes: [],
      };
    }

    const positionPermissions = await this.prisma.positionPermission.findMany({
      where: {
        OR: holders.map((h) => ({
          holderKind: h.holderKind,
          holderId: h.holderId,
        })),
      },
      include: {
        parentScopes: true,
        permissionGroupVersion: { include: versionInclude },
      },
    });

    const orgScopes: OrgScopeNode[] = [];
    const scopeKeys = new Set<string>();

    for (const pp of positionPermissions) {
      for (const code of this.codesFromVersion(pp.permissionGroupVersion)) {
        codes.add(code);
      }

      const selfNode = holders.find(
        (h) => h.holderKind === pp.holderKind && h.holderId === pp.holderId,
      )?.selfNode;
      if (pp.includeSelf && selfNode) {
        const key = orgScopeKey(selfNode.type, selfNode.id);
        if (!scopeKeys.has(key)) {
          scopeKeys.add(key);
          orgScopes.push(selfNode);
        }
      }
      for (const parent of pp.parentScopes) {
        const node: OrgScopeNode = {
          type: parent.nodeType as OrgNodeType,
          id: parent.nodeId,
        };
        const key = orgScopeKey(node.type, node.id);
        if (!scopeKeys.has(key)) {
          scopeKeys.add(key);
          orgScopes.push(node);
        }
      }
    }

    return {
      permissions: Array.from(codes),
      isSystemAdmin: false,
      orgScopes,
    };
  }

  async getPositionPermission(
    holderKind: PositionHolderKind,
    holderId: string,
  ): Promise<PositionPermissionSummary | null> {
    const pp = await this.prisma.positionPermission.findUnique({
      where: {
        holderKind_holderId: { holderKind, holderId },
      },
      include: {
        parentScopes: true,
        permissionGroupVersion: { include: versionInclude },
      },
    });
    if (!pp) {
      return null;
    }
    return this.toSummary(pp);
  }

  async getManyPositionPermissions(
    holders: Array<{ holderKind: PositionHolderKind; holderId: string }>,
  ): Promise<Map<string, PositionPermissionSummary>> {
    const map = new Map<string, PositionPermissionSummary>();
    if (holders.length === 0) {
      return map;
    }
    const rows = await this.prisma.positionPermission.findMany({
      where: {
        OR: holders.map((h) => ({
          holderKind: h.holderKind,
          holderId: h.holderId,
        })),
      },
      include: {
        parentScopes: true,
        permissionGroupVersion: { include: versionInclude },
      },
    });
    for (const row of rows) {
      map.set(`${row.holderKind}:${row.holderId}`, this.toSummary(row));
    }
    return map;
  }

  async upsertPositionPermission(
    holderKind: PositionHolderKind,
    holderId: string,
    input: PositionPermissionInput | null | undefined,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    if (input === null) {
      await db.positionPermission.deleteMany({
        where: { holderKind, holderId },
      });
      return null;
    }
    if (input === undefined) {
      return this.getPositionPermission(holderKind, holderId);
    }

    if (holderKind === PositionHolderKind.UNIT_MEMBER) {
      await this.assertUnitMemberExists(holderId, db);
    }
    if (holderKind === PositionHolderKind.ORGANIZATION_MEMBER) {
      const member = await db.organizationMember.findUnique({
        where: { id: holderId },
      });
      if (!member) throw new NotFoundException('Organization member not found');
    }
    if (holderKind === PositionHolderKind.COMPANY_MEMBER) {
      const member = await db.companyMember.findUnique({
        where: { id: holderId },
      });
      if (!member) throw new NotFoundException('Company member not found');
    }

    const versionId = await this.resolveVersionId(input, db);
    if (!versionId) {
      await db.positionPermission.deleteMany({
        where: { holderKind, holderId },
      });
      return null;
    }

    await this.validateParentScopes(holderKind, holderId, input.parentScopes ?? [], db);

    const existing = await db.positionPermission.findUnique({
      where: { holderKind_holderId: { holderKind, holderId } },
    });

    const includeSelf = input.includeSelf ?? true;
    let positionPermissionId: string;

    if (existing) {
      await db.positionPermission.update({
        where: { id: existing.id },
        data: {
          permissionGroupVersionId: versionId,
          includeSelf,
        },
      });
      positionPermissionId = existing.id;
      await db.positionPermissionParentScope.deleteMany({
        where: { positionPermissionId },
      });
    } else {
      const created = await db.positionPermission.create({
        data: {
          holderKind,
          holderId,
          permissionGroupVersionId: versionId,
          includeSelf,
        },
      });
      positionPermissionId = created.id;
    }

    const parents = input.parentScopes ?? [];
    if (parents.length > 0) {
      await db.positionPermissionParentScope.createMany({
        data: parents.map((p) => ({
          positionPermissionId,
          nodeType: p.type,
          nodeId: p.id,
        })),
      });
    }

    return this.getPositionPermission(holderKind, holderId);
  }

  async deleteByHolder(
    holderKind: PositionHolderKind,
    holderId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    await db.positionPermission.deleteMany({ where: { holderKind, holderId } });
  }

  async deleteByHolders(
    holders: Array<{ holderKind: PositionHolderKind; holderId: string }>,
    tx?: Prisma.TransactionClient,
  ) {
    if (holders.length === 0) return;
    const db = tx ?? this.prisma;
    await db.positionPermission.deleteMany({
      where: {
        OR: holders.map((h) => ({
          holderKind: h.holderKind,
          holderId: h.holderId,
        })),
      },
    });
  }

  assertCanAccessNode(
    isSystemAdmin: boolean,
    orgScopes: OrgScopeNode[],
    nodeType: OrgNodeType,
    nodeId: string,
    ancestorKeys: string[],
  ) {
    if (!hasOrgScopeAccess(isSystemAdmin, orgScopes, nodeType, nodeId, ancestorKeys)) {
      throw new ForbiddenException('Outside permitted organization scope');
    }
  }

  filterTreeByScope<T extends {
    id: string;
    type: OrgNodeType;
    children: T[];
  }>(
    tree: T,
    isSystemAdmin: boolean,
    orgScopes: OrgScopeNode[],
  ): T | null {
    if (isSystemAdmin) {
      return tree;
    }
    // Chưa gắn vị trí (orgScopes rỗng) → không giới hạn phạm vi.
    if (orgScopes.length === 0) {
      return tree;
    }

    const grantKeys = new Set(orgScopes.map((s) => orgScopeKey(s.type, s.id)));

    const filterNode = (node: T, ancestorKeys: string[]): T | null => {
      const key = orgScopeKey(node.type, node.id);
      const nextAncestors = [...ancestorKeys, key];
      const children = node.children
        .map((child) => filterNode(child, nextAncestors))
        .filter((c): c is T => c !== null);

      const selfGranted = grantKeys.has(key);
      const underGrant = ancestorKeys.some((a) => grantKeys.has(a));
      const hasVisibleChild = children.length > 0;

      if (!selfGranted && !underGrant && !hasVisibleChild) {
        return null;
      }

      return { ...node, children, childCount: children.length } as T;
    };

    return filterNode(tree, []);
  }

  async countByVersion(versionId: string) {
    return this.prisma.positionPermission.count({
      where: { permissionGroupVersionId: versionId },
    });
  }

  async listHoldersByVersion(versionId: string) {
    const rows = await this.prisma.positionPermission.findMany({
      where: { permissionGroupVersionId: versionId },
      include: { parentScopes: true },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      rows.map(async (row) => {
        const label = await this.describeHolder(row.holderKind, row.holderId);
        return {
          holderKind: row.holderKind,
          holderId: row.holderId,
          includeSelf: row.includeSelf,
          parentScopes: row.parentScopes.map((p) => ({
            type: p.nodeType as OrgNodeType,
            id: p.nodeId,
          })),
          ...label,
        };
      }),
    );
  }

  async countByGroup(permissionGroupId: string) {
    return this.prisma.positionPermission.count({
      where: {
        permissionGroupVersion: { permissionGroupId },
      },
    });
  }

  private async findHoldersForUser(userId: string): Promise<
    Array<{
      holderKind: PositionHolderKind;
      holderId: string;
      selfNode: OrgScopeNode;
    }>
  > {
    const [orgs, companies, units, unitMembers, orgMembers, companyMembers] =
      await Promise.all([
        this.prisma.organization.findMany({
          where: { linkedProfileUserId: userId },
          select: { id: true },
        }),
        this.prisma.company.findMany({
          where: { linkedProfileUserId: userId },
          select: { id: true },
        }),
        this.prisma.organizationUnit.findMany({
          where: { linkedProfileUserId: userId },
          select: { id: true },
        }),
        this.prisma.organizationUnitMember.findMany({
          where: { linkedProfileUserId: userId },
          select: { id: true, unitId: true },
        }),
        this.prisma.organizationMember.findMany({
          where: { linkedProfileUserId: userId },
          select: { id: true, organizationId: true },
        }),
        this.prisma.companyMember.findMany({
          where: { linkedProfileUserId: userId },
          select: { id: true, companyId: true },
        }),
      ]);

    return [
      ...orgs.map((o) => ({
        holderKind: PositionHolderKind.ORGANIZATION_REP,
        holderId: o.id,
        selfNode: { type: OrgNodeType.ORGANIZATION, id: o.id },
      })),
      ...companies.map((c) => ({
        holderKind: PositionHolderKind.COMPANY_REP,
        holderId: c.id,
        selfNode: { type: OrgNodeType.COMPANY, id: c.id },
      })),
      ...units.map((u) => ({
        holderKind: PositionHolderKind.UNIT_MANAGER,
        holderId: u.id,
        selfNode: { type: OrgNodeType.UNIT, id: u.id },
      })),
      ...unitMembers.map((m) => ({
        holderKind: PositionHolderKind.UNIT_MEMBER,
        holderId: m.id,
        selfNode: { type: OrgNodeType.UNIT, id: m.unitId },
      })),
      ...orgMembers.map((m) => ({
        holderKind: PositionHolderKind.ORGANIZATION_MEMBER,
        holderId: m.id,
        selfNode: { type: OrgNodeType.ORGANIZATION, id: m.organizationId },
      })),
      ...companyMembers.map((m) => ({
        holderKind: PositionHolderKind.COMPANY_MEMBER,
        holderId: m.id,
        selfNode: { type: OrgNodeType.COMPANY, id: m.companyId },
      })),
    ];
  }

  private codesFromVersion(version: {
    permissions: Array<{ permission: { code: string } }>;
  }): PermissionCode[] {
    return version.permissions.map((p) => p.permission.code as PermissionCode);
  }

  private permissionIdsFromVersion(version: {
    permissions: Array<{ permissionId: string }>;
  }): string[] {
    return version.permissions.map((p) => p.permissionId);
  }

  private toSummary(pp: {
    holderKind: PositionHolderKind;
    holderId: string;
    includeSelf: boolean;
    parentScopes: Array<{ nodeType: string; nodeId: string }>;
    permissionGroupVersion: {
      id: string;
      name: string;
      permissionGroupId: string;
      versionNumber: number;
      permissions: Array<{ permissionId: string; permission: { code: string } }>;
    };
  }): PositionPermissionSummary {
    return {
      holderKind: pp.holderKind,
      holderId: pp.holderId,
      permissionGroupVersionId: pp.permissionGroupVersion.id,
      permissionGroupName: pp.permissionGroupVersion.name,
      permissionGroupId: pp.permissionGroupVersion.permissionGroupId,
      selectedPermissionIds: this.permissionIdsFromVersion(pp.permissionGroupVersion),
      includeSelf: pp.includeSelf,
      parentScopes: pp.parentScopes.map((p) => ({
        type: p.nodeType as OrgNodeType,
        id: p.nodeId,
      })),
    };
  }

  private async resolveVersionId(
    input: PositionPermissionInput,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<string | null> {
    if (
      !input.permissionGroupId &&
      !input.permissionGroupVersionId &&
      (!input.permissionIds || input.permissionIds.length === 0)
    ) {
      return null;
    }

    let baseGroupId = input.permissionGroupId ?? null;
    let defaultVersion = null as null | {
      id: string;
      permissionGroupId: string;
      permissions: Array<{ permissionId: string }>;
      permissionGroup: { id: string; name: string };
    };

    if (input.permissionGroupVersionId && !input.permissionIds) {
      const version = await db.permissionGroupVersion.findUnique({
        where: { id: input.permissionGroupVersionId },
      });
      if (!version) {
        throw new NotFoundException('Permission group version not found');
      }
      if (version.isCustom === false || version.versionNumber === 0) {
        return version.id;
      }
      return version.id;
    }

    if (input.permissionGroupVersionId && !baseGroupId) {
      const version = await db.permissionGroupVersion.findUnique({
        where: { id: input.permissionGroupVersionId },
      });
      if (!version) {
        throw new NotFoundException('Permission group version not found');
      }
      baseGroupId = version.permissionGroupId;
    }

    if (!baseGroupId) {
      throw new BadRequestException('permissionGroupId is required when customizing permissions');
    }

    defaultVersion = await db.permissionGroupVersion.findFirst({
      where: { permissionGroupId: baseGroupId, versionNumber: 0 },
      include: {
        permissions: true,
        permissionGroup: true,
      },
    });
    if (!defaultVersion) {
      throw new NotFoundException('Default permission group version not found');
    }

    if (!input.permissionIds) {
      return defaultVersion.id;
    }

    const defaultIds = defaultVersion.permissions.map((p) => p.permissionId).sort();
    const requestedIds = [...input.permissionIds].sort();

    if (this.sameIds(defaultIds, requestedIds)) {
      return defaultVersion.id;
    }

    const customVersions = await db.permissionGroupVersion.findMany({
      where: { permissionGroupId: baseGroupId, isCustom: true },
      include: { permissions: true },
    });
    const matched = customVersions.find((v) =>
      this.sameIds(
        v.permissions.map((p) => p.permissionId).sort(),
        requestedIds,
      ),
    );
    if (matched) {
      return matched.id;
    }

    const maxCustom = await db.permissionGroupVersion.aggregate({
      where: { permissionGroupId: baseGroupId, isCustom: true },
      _max: { versionNumber: true },
    });
    const nextNumber = (maxCustom._max.versionNumber ?? 0) + 1;
    const customName = `${defaultVersion.permissionGroup.name}-tùy chỉnh${nextNumber}`;

    const created = await db.permissionGroupVersion.create({
      data: {
        permissionGroupId: baseGroupId,
        versionNumber: nextNumber,
        name: customName,
        isCustom: true,
      },
    });
    if (requestedIds.length > 0) {
      await db.permissionGroupVersionPermission.createMany({
        data: requestedIds.map((permissionId) => ({
          versionId: created.id,
          permissionId,
        })),
      });
    }
    return created.id;
  }

  private async assertUnitMemberExists(
    unitMemberId: string,
    db: Prisma.TransactionClient | PrismaService,
  ) {
    const member = await db.organizationUnitMember.findUnique({
      where: { id: unitMemberId },
    });
    if (!member) {
      throw new NotFoundException('Unit member not found');
    }
  }

  private async validateParentScopes(
    holderKind: PositionHolderKind,
    holderId: string,
    parentScopes: OrgScopeNode[],
    db: Prisma.TransactionClient | PrismaService,
  ) {
    if (parentScopes.length === 0) {
      return;
    }
    const allowed = await this.getAllowedParentScopes(holderKind, holderId, db);
    const allowedKeys = new Set(allowed.map((a) => orgScopeKey(a.type, a.id)));
    for (const scope of parentScopes) {
      if (!allowedKeys.has(orgScopeKey(scope.type, scope.id))) {
        throw new BadRequestException(
          `Invalid parent scope ${scope.type}:${scope.id} for this position`,
        );
      }
    }
  }

  async getAllowedParentScopes(
    holderKind: PositionHolderKind,
    holderId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<OrgScopeNode[]> {
    if (holderKind === PositionHolderKind.ORGANIZATION_REP) {
      return [];
    }

    if (holderKind === PositionHolderKind.COMPANY_REP) {
      const company = await db.company.findUnique({ where: { id: holderId } });
      if (!company) throw new NotFoundException('Company not found');
      return [{ type: OrgNodeType.ORGANIZATION, id: company.organizationId }];
    }

    if (holderKind === PositionHolderKind.UNIT_MANAGER) {
      return this.unitAncestorScopes(holderId, db);
    }

    if (holderKind === PositionHolderKind.UNIT_MEMBER) {
      const member = await db.organizationUnitMember.findUnique({
        where: { id: holderId },
      });
      if (!member) throw new NotFoundException('Unit member not found');
      return this.unitAncestorScopes(member.unitId, db);
    }

    if (holderKind === PositionHolderKind.ORGANIZATION_MEMBER) {
      return [];
    }

    if (holderKind === PositionHolderKind.COMPANY_MEMBER) {
      const member = await db.companyMember.findUnique({
        where: { id: holderId },
        include: { company: true },
      });
      if (!member) throw new NotFoundException('Company member not found');
      return [
        { type: OrgNodeType.ORGANIZATION, id: member.company.organizationId },
      ];
    }

    return [];
  }

  private async unitAncestorScopes(
    unitId: string,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<OrgScopeNode[]> {
    const unit = await db.organizationUnit.findUnique({
      where: { id: unitId },
      include: { company: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const scopes: OrgScopeNode[] = [
      { type: OrgNodeType.COMPANY, id: unit.companyId },
      { type: OrgNodeType.ORGANIZATION, id: unit.company.organizationId },
    ];

    let parentId = unit.parentUnitId;
    while (parentId) {
      scopes.unshift({ type: OrgNodeType.UNIT, id: parentId });
      const parent = await db.organizationUnit.findUnique({
        where: { id: parentId },
        select: { parentUnitId: true },
      });
      parentId = parent?.parentUnitId ?? null;
    }

    return scopes;
  }

  private async describeHolder(holderKind: PositionHolderKind, holderId: string) {
    switch (holderKind) {
      case PositionHolderKind.ORGANIZATION_REP: {
        const org = await this.prisma.organization.findUnique({
          where: { id: holderId },
        });
        return {
          label: org ? `Đại diện: ${org.name}` : holderId,
          nodeType: OrgNodeType.ORGANIZATION,
          nodeId: holderId,
        };
      }
      case PositionHolderKind.COMPANY_REP: {
        const company = await this.prisma.company.findUnique({
          where: { id: holderId },
        });
        return {
          label: company ? `Đại diện: ${company.name}` : holderId,
          nodeType: OrgNodeType.COMPANY,
          nodeId: holderId,
        };
      }
      case PositionHolderKind.UNIT_MANAGER: {
        const unit = await this.prisma.organizationUnit.findUnique({
          where: { id: holderId },
        });
        return {
          label: unit ? `Phụ trách: ${unit.name}` : holderId,
          nodeType: OrgNodeType.UNIT,
          nodeId: holderId,
        };
      }
      case PositionHolderKind.UNIT_MEMBER: {
        const member = await this.prisma.organizationUnitMember.findUnique({
          where: { id: holderId },
          include: { unit: true },
        });
        return {
          label: member
            ? `${member.position}: ${member.memberName} (${member.unit.name})`
            : holderId,
          nodeType: OrgNodeType.UNIT,
          nodeId: member?.unitId ?? holderId,
        };
      }
      case PositionHolderKind.ORGANIZATION_MEMBER: {
        const member = await this.prisma.organizationMember.findUnique({
          where: { id: holderId },
        });
        return {
          label: member
            ? `${member.position}: ${member.memberName}`
            : holderId,
          nodeType: OrgNodeType.ORGANIZATION,
          nodeId: member?.organizationId ?? holderId,
        };
      }
      case PositionHolderKind.COMPANY_MEMBER: {
        const member = await this.prisma.companyMember.findUnique({
          where: { id: holderId },
        });
        return {
          label: member
            ? `${member.position}: ${member.memberName}`
            : holderId,
          nodeType: OrgNodeType.COMPANY,
          nodeId: member?.companyId ?? holderId,
        };
      }
    }
  }

  private sameIds(a: string[], b: string[]) {
    return a.length === b.length && a.every((id, index) => id === b[index]);
  }
}
