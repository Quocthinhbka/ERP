import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG } from './permission-catalog';

/**
 * Đồng bộ catalog quyền khi API khởi động.
 * Super Admin xác định qua cột User.isSuperAdmin (không dùng bảng Role).
 * Không tạo user / tổ chức / nhóm quyền mẫu (không seed).
 */
@Injectable()
export class PermissionsSyncService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsSyncService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.sync();
  }

  async sync() {
    for (const def of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { code: def.code },
        update: {
          name: def.name,
          module: def.module,
          description: def.description,
        },
        create: def,
      });
    }

    // Chỉ xoá quyền không còn trong catalog VÀ không còn được nhóm quyền nào tham chiếu,
    // tránh vô tình gỡ quyền đang gán khi catalog tạm thiếu.
    const catalogCodes = new Set(PERMISSION_CATALOG.map((d) => d.code));
    const obsolete = await this.prisma.permission.findMany({
      where: { code: { notIn: [...catalogCodes] } },
      select: { id: true, _count: { select: { groupVersions: true } } },
    });
    const removableIds = obsolete
      .filter((p) => p._count.groupVersions === 0)
      .map((p) => p.id);
    if (removableIds.length > 0) {
      await this.prisma.permission.deleteMany({
        where: { id: { in: removableIds } },
      });
    }

    this.logger.log('Synced permission catalog');
  }
}
