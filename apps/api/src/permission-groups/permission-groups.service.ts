import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PositionPermissionsService } from '../organization/position-permissions.service';
import {
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
} from './dto/permission-group.dto';

const groupInclude = {
  versions: {
    orderBy: { versionNumber: 'asc' },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { positionPermissions: true } },
    },
  },
} as const;

@Injectable()
export class PermissionGroupsService {
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async findAll() {
    const groups = await this.prisma.permissionGroup.findMany({
      where: { deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: groupInclude,
    });

    return groups.map((group) => {
      const defaultVersion = group.versions.find((v) => v.versionNumber === 0);
      const customVersions = group.versions.filter((v) => v.isCustom);
      const defaultPermissions = defaultVersion?.permissions ?? [];
      const defaultPositionCount = defaultVersion?._count.positionPermissions ?? 0;

      return {
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
        isDefault: group.isDefault,
        permissionCount: defaultPermissions.length,
        positionCount: group.versions.reduce(
          (sum, v) => sum + v._count.positionPermissions,
          0,
        ),
        permissions: this.groupPermissionsByModule(
          defaultPermissions.map((p) => p.permission),
        ),
        versions: [
          {
            id: defaultVersion?.id ?? group.id,
            name: group.name,
            versionNumber: 0,
            isCustom: false,
            permissionCount: defaultPermissions.length,
            positionCount: defaultPositionCount,
          },
          ...customVersions.map((v) => ({
            id: v.id,
            name: v.name,
            versionNumber: v.versionNumber,
            isCustom: true,
            permissionCount: v.permissions.length,
            positionCount: v._count.positionPermissions,
          })),
        ],
      };
    });
  }

  async findOne(id: string) {
    const group = await this.getGroupOrThrow(id);
    return this.toGroupDetail(group);
  }

  async getVersionPermissions(versionId: string) {
    const version = await this.prisma.permissionGroupVersion.findUnique({
      where: { id: versionId },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!version) {
      throw new NotFoundException('Permission group version not found');
    }

    return {
      versionId: version.id,
      name: version.name,
      isCustom: version.isCustom,
      permissions: this.groupPermissionsByModule(
        version.permissions.map((p) => p.permission),
      ),
    };
  }

  async getVersionAccounts(versionId: string) {
    const version = await this.prisma.permissionGroupVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException('Permission group version not found');
    }

    const positions = await this.positionPermissions.listHoldersByVersion(versionId);
    return {
      versionId: version.id,
      name: version.name,
      positions,
      accounts: positions,
    };
  }

  async create(dto: CreatePermissionGroupDto) {
    const existing = await this.prisma.permissionGroup.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException('Mã nhóm quyền đã tồn tại');
    }

    const permissionIds = await this.ensurePermissionIdsExist(
      dto.permissionIds ?? [],
    );

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.permissionGroup.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });

      const version = await tx.permissionGroupVersion.create({
        data: {
          permissionGroupId: created.id,
          versionNumber: 0,
          name: created.name,
          isCustom: false,
        },
      });

      if (permissionIds.length > 0) {
        await tx.permissionGroupVersionPermission.createMany({
          data: permissionIds.map((permissionId) => ({
            versionId: version.id,
            permissionId,
          })),
        });
      }

      return created;
    });

    return this.findOne(group.id);
  }

  async update(id: string, dto: UpdatePermissionGroupDto) {
    await this.getGroupOrThrow(id);
    const permissionIds = dto.permissionIds
      ? await this.ensurePermissionIdsExist(dto.permissionIds)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.permissionGroup.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      const defaultVersion = await tx.permissionGroupVersion.findFirst({
        where: { permissionGroupId: id, versionNumber: 0 },
      });
      if (defaultVersion && (dto.name || permissionIds)) {
        if (permissionIds) {
          await tx.permissionGroupVersionPermission.deleteMany({
            where: { versionId: defaultVersion.id },
          });
          if (permissionIds.length > 0) {
            await tx.permissionGroupVersionPermission.createMany({
              data: permissionIds.map((permissionId) => ({
                versionId: defaultVersion.id,
                permissionId,
              })),
            });
          }
        }
        if (dto.name) {
          await tx.permissionGroupVersion.update({
            where: { id: defaultVersion.id },
            data: { name: dto.name },
          });
        }
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const group = await this.getGroupOrThrow(id);
    if (group.isDefault) {
      throw new BadRequestException('Cannot delete default permission group');
    }

    const positionCount = await this.positionPermissions.countByGroup(id);
    if (positionCount > 0) {
      throw new BadRequestException('Cannot delete permission group with assigned positions');
    }

    await this.prisma.permissionGroup.delete({ where: { id } });
    return { success: true };
  }

  private async ensurePermissionIdsExist(permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    if (uniqueIds.length === 0) return uniqueIds;

    const found = await this.prisma.permission.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Danh sách quyền không hợp lệ hoặc đã thay đổi. Tải lại trang rồi chọn lại quyền.',
      );
    }
    return uniqueIds;
  }

  private async getGroupOrThrow(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: groupInclude,
    });
    if (!group) {
      throw new NotFoundException('Permission group not found');
    }
    return group;
  }

  private toGroupDetail(group: Awaited<ReturnType<typeof this.getGroupOrThrow>>) {
    const defaultVersion = group.versions.find((v) => v.versionNumber === 0);
    const defaultPermissions = defaultVersion?.permissions ?? [];
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      description: group.description,
      isDefault: group.isDefault,
      permissionCount: defaultPermissions.length,
      positionCount: group.versions.reduce(
        (sum, v) => sum + v._count.positionPermissions,
        0,
      ),
      permissionIds: defaultPermissions.map((p) => p.permissionId),
      permissions: this.groupPermissionsByModule(
        defaultPermissions.map((p) => p.permission),
      ),
      versions: group.versions.map((v) => ({
        id: v.id,
        name: v.name,
        versionNumber: v.versionNumber,
        isCustom: v.isCustom,
        permissionCount: v.permissions.length,
        positionCount: v._count.positionPermissions,
      })),
      defaultVersionId: defaultVersion?.id ?? null,
    };
  }

  private groupPermissionsByModule(
    permissions: Array<{ id: string; code: string; name: string; module: string }>,
  ) {
    const grouped: Record<string, typeof permissions> = {};
    for (const permission of permissions) {
      grouped[permission.module] ??= [];
      grouped[permission.module].push(permission);
    }
    return grouped;
  }
}
