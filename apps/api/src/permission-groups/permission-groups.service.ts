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

@Injectable()
export class PermissionGroupsService {
  constructor(
    private prisma: PrismaService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async findAll() {
    const groups = await this.prisma.permissionGroup.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        permissions: { include: { permission: true } },
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: {
            permissions: true,
            _count: { select: { positionPermissions: true } },
          },
        },
      },
    });

    return groups.map((group) => {
      const defaultVersion = group.versions.find((v) => v.versionNumber === 0);
      const customVersions = group.versions.filter((v) => v.isCustom);
      const defaultPositionCount = defaultVersion?._count.positionPermissions ?? 0;

      return {
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
        isDefault: group.isDefault,
        permissionCount: group.permissions.length,
        positionCount: group.versions.reduce(
          (sum, v) => sum + v._count.positionPermissions,
          0,
        ),
        permissions: this.groupPermissionsByModule(
          group.permissions.map((p) => p.permission),
        ),
        versions: [
          {
            id: defaultVersion?.id ?? group.id,
            name: group.name,
            versionNumber: 0,
            isCustom: false,
            permissionCount: group.permissions.length,
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
        permissionGroup: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });
    if (!version) {
      throw new NotFoundException('Permission group version not found');
    }

    const permissions =
      version.versionNumber === 0
        ? version.permissionGroup.permissions.map((p) => p.permission)
        : version.permissions.map((p) => p.permission);

    return {
      versionId: version.id,
      name: version.name,
      isCustom: version.isCustom,
      permissions: this.groupPermissionsByModule(permissions),
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
      throw new BadRequestException('Permission group code already exists');
    }

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.permissionGroup.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });

      if (dto.permissionIds.length > 0) {
        await tx.permissionGroupPermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            permissionGroupId: created.id,
            permissionId,
          })),
        });
      }

      const version = await tx.permissionGroupVersion.create({
        data: {
          permissionGroupId: created.id,
          versionNumber: 0,
          name: created.name,
          isCustom: false,
        },
      });

      if (dto.permissionIds.length > 0) {
        await tx.permissionGroupVersionPermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
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

    await this.prisma.$transaction(async (tx) => {
      await tx.permissionGroup.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      if (dto.permissionIds) {
        await tx.permissionGroupPermission.deleteMany({ where: { permissionGroupId: id } });
        if (dto.permissionIds.length > 0) {
          await tx.permissionGroupPermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({
              permissionGroupId: id,
              permissionId,
            })),
          });
        }

        const defaultVersion = await tx.permissionGroupVersion.findFirst({
          where: { permissionGroupId: id, versionNumber: 0 },
        });
        if (defaultVersion) {
          await tx.permissionGroupVersionPermission.deleteMany({
            where: { versionId: defaultVersion.id },
          });
          if (dto.permissionIds.length > 0) {
            await tx.permissionGroupVersionPermission.createMany({
              data: dto.permissionIds.map((permissionId) => ({
                versionId: defaultVersion.id,
                permissionId,
              })),
            });
          }
          if (dto.name) {
            await tx.permissionGroupVersion.update({
              where: { id: defaultVersion.id },
              data: { name: dto.name },
            });
          }
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

  private async getGroupOrThrow(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: { _count: { select: { positionPermissions: true } } },
        },
      },
    });
    if (!group) {
      throw new NotFoundException('Permission group not found');
    }
    return group;
  }

  private toGroupDetail(group: Awaited<ReturnType<typeof this.getGroupOrThrow>>) {
    const defaultVersion = group.versions.find((v) => v.versionNumber === 0);
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      description: group.description,
      isDefault: group.isDefault,
      permissionCount: group.permissions.length,
      positionCount: group.versions.reduce(
        (sum, v) => sum + v._count.positionPermissions,
        0,
      ),
      permissionIds: group.permissions.map((p) => p.permissionId),
      permissions: this.groupPermissionsByModule(
        group.permissions.map((p) => p.permission),
      ),
      versions: group.versions.map((v) => ({
        id: v.id,
        name: v.name,
        versionNumber: v.versionNumber,
        isCustom: v.isCustom,
        permissionCount: v.isCustom ? undefined : group.permissions.length,
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
