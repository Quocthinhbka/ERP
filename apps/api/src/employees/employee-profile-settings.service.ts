import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  DEFAULT_PROFILE_FIELDS,
  DEFAULT_PROFILE_TABS,
  EmployeeProfileFieldDataType,
  type ProfileFieldOptions,
} from '@erp/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttachFieldToTabDto,
  CreateProfileFieldDto,
  CreateProfileTabDto,
  UpdateProfileFieldDto,
  UpdateProfileTabDto,
} from './dto/employee-profile-settings.dto';

export type EmployeeProfileFieldSettingItem = {
  fieldKey: string;
  label: string;
  visible: boolean;
  required: boolean;
  sortOrder: number;
  locked: boolean;
  kind: 'scalar' | 'section';
  storageKey: string | null;
};

export type ProfileLayoutField = {
  id: string;
  code: string;
  label: string;
  dataType: EmployeeProfileFieldDataType;
  options: ProfileFieldOptions | null;
  required: boolean;
  visible: boolean;
  locked: boolean;
  isSystem: boolean;
  storageKey: string | null;
  sortOrder: number;
  tabIds: string[];
};

export type ProfileLayoutTab = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  visible: boolean;
  fields: ProfileLayoutField[];
};

@Injectable()
export class EmployeeProfileSettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async ensureDefaults() {
    for (const tab of DEFAULT_PROFILE_TABS) {
      await this.prisma.employeeProfileTab.upsert({
        where: { code: tab.code },
        create: {
          code: tab.code,
          name: tab.name,
          sortOrder: tab.sortOrder,
          isSystem: tab.isSystem,
          visible: true,
        },
        update: {
          name: tab.name,
          isSystem: tab.isSystem,
        },
      });
    }

    const tabs = await this.prisma.employeeProfileTab.findMany();
    const tabByCode = new Map(tabs.map((t) => [t.code, t]));

    for (const field of DEFAULT_PROFILE_FIELDS) {
      const created = await this.prisma.employeeProfileFieldDef.upsert({
        where: { code: field.code },
        create: {
          code: field.code,
          label: field.label,
          dataType: field.dataType,
          options:
            field.options === undefined || field.options === null
              ? Prisma.JsonNull
              : (field.options as Prisma.InputJsonValue),
          required: field.required ?? false,
          visible: field.visible ?? true,
          isSystem: field.isSystem ?? false,
          locked: field.locked ?? false,
          storageKey: field.storageKey ?? null,
          sortOrder: field.sortOrder,
        },
        update: {
          label: field.label,
          dataType: field.dataType,
          options:
            field.options === undefined || field.options === null
              ? Prisma.JsonNull
              : (field.options as Prisma.InputJsonValue),
          isSystem: field.isSystem ?? false,
          locked: field.locked ?? false,
          storageKey: field.storageKey ?? null,
          // Field system khóa: đồng bộ required từ seed (vd. công ty chủ quản).
          ...(field.locked ? { required: field.required ?? false } : {}),
        },
      });

      const desiredTabIds: string[] = [];
      for (const [index, tabCode] of field.tabCodes.entries()) {
        const tab = tabByCode.get(tabCode);
        if (!tab) continue;
        desiredTabIds.push(tab.id);
        await this.prisma.employeeProfileTabField.upsert({
          where: {
            tabId_fieldDefId: {
              tabId: tab.id,
              fieldDefId: created.id,
            },
          },
          create: {
            tabId: tab.id,
            fieldDefId: created.id,
            sortOrder: field.sortOrder + index,
          },
          update: {},
        });
      }

      // Field hệ thống: đồng bộ đúng tab theo seed (gỡ link thừa, vd. managingCompanyId
      // từng gắn cả personal + contract gây trùng Form.Item trên form sửa).
      if (field.isSystem) {
        await this.prisma.employeeProfileTabField.deleteMany({
          where: {
            fieldDefId: created.id,
            ...(desiredTabIds.length > 0
              ? { tabId: { notIn: desiredTabIds } }
              : {}),
          },
        });
      }
    }
  }

  async getLayout(): Promise<{ tabs: ProfileLayoutTab[]; fields: ProfileLayoutField[] }> {
    await this.ensureDefaults();
    const [tabs, fields] = await Promise.all([
      this.prisma.employeeProfileTab.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          fields: {
            orderBy: { sortOrder: 'asc' },
            include: { fieldDef: true },
          },
        },
      }),
      this.prisma.employeeProfileFieldDef.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { tabLinks: { select: { tabId: true } } },
      }),
    ]);

    const fieldTabIds = new Map(
      fields.map((f) => [f.id, f.tabLinks.map((l) => l.tabId)]),
    );

    return {
      tabs: tabs.map((tab) => ({
        id: tab.id,
        code: tab.code,
        name: tab.name,
        sortOrder: tab.sortOrder,
        isSystem: tab.isSystem,
        visible: tab.visible,
        fields: tab.fields.map((link) =>
          this.mapField(
            link.fieldDef,
            link.sortOrder,
            fieldTabIds.get(link.fieldDef.id) ?? [tab.id],
          ),
        ),
      })),
      fields: fields.map((f) =>
        this.mapField(f, undefined, f.tabLinks.map((l) => l.tabId)),
      ),
    };
  }

  async list(): Promise<EmployeeProfileFieldSettingItem[]> {
    await this.ensureDefaults();
    const rows = await this.prisma.employeeProfileFieldDef.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => ({
      fieldKey: row.code,
      label: row.label,
      visible: row.visible,
      required: row.visible ? row.required : false,
      sortOrder: row.sortOrder,
      locked: row.locked,
      storageKey: row.storageKey,
      kind:
        row.dataType === EmployeeProfileFieldDataType.SECTION
          ? 'section'
          : 'scalar',
    }));
  }

  async replaceAll(
    items: Array<{
      fieldKey: string;
      visible: boolean;
      required: boolean;
    }>,
  ) {
    const defs = await this.prisma.employeeProfileFieldDef.findMany();
    const byCode = new Map(defs.map((d) => [d.code, d]));

    for (const item of items) {
      const def = byCode.get(item.fieldKey);
      if (!def) {
        throw new BadRequestException(`Field không hợp lệ: ${item.fieldKey}`);
      }
      const visible = def.locked ? true : Boolean(item.visible);
      const required = def.locked ? true : visible ? Boolean(item.required) : false;
      await this.prisma.employeeProfileFieldDef.update({
        where: { id: def.id },
        data: { visible, required },
      });
    }

    return this.getLayout();
  }

  async createTab(dto: CreateProfileTabDto) {
    const max = await this.prisma.employeeProfileTab.aggregate({
      _max: { sortOrder: true },
    });
    const code = `tab_${Date.now().toString(36)}`;
    await this.prisma.employeeProfileTab.create({
      data: {
        code,
        name: dto.name.trim(),
        visible: dto.visible ?? true,
        isSystem: false,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    return this.getLayout();
  }

  async updateTab(id: string, dto: UpdateProfileTabDto) {
    const tab = await this.prisma.employeeProfileTab.findUnique({ where: { id } });
    if (!tab) throw new NotFoundException('Tab không tồn tại');
    await this.prisma.employeeProfileTab.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.visible !== undefined ? { visible: dto.visible } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.getLayout();
  }

  async deleteTab(id: string) {
    const tab = await this.prisma.employeeProfileTab.findUnique({
      where: { id },
      include: { fields: { select: { id: true } } },
    });
    if (!tab) throw new NotFoundException('Tab không tồn tại');
    if (tab.isSystem) {
      throw new BadRequestException('Không thể xóa tab hệ thống');
    }
    if (tab.fields.length > 0) {
      throw new BadRequestException(
        'Tab còn trường — bỏ trường khỏi tab trước khi xóa',
      );
    }
    await this.prisma.employeeProfileTab.delete({ where: { id } });
    return this.getLayout();
  }

  async reorderTabs(tabIds: string[]) {
    const tabs = await this.prisma.employeeProfileTab.findMany();
    if (tabIds.length !== tabs.length || new Set(tabIds).size !== tabIds.length) {
      throw new BadRequestException('Danh sách tab không hợp lệ');
    }
    const have = new Set(tabs.map((t) => t.id));
    for (const id of tabIds) {
      if (!have.has(id)) throw new BadRequestException('Tab không tồn tại');
    }
    await this.prisma.$transaction(
      tabIds.map((id, sortOrder) =>
        this.prisma.employeeProfileTab.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    return this.getLayout();
  }

  async createField(dto: CreateProfileFieldDto) {
    this.assertFieldOptions(dto.dataType, dto.options);
    const max = await this.prisma.employeeProfileFieldDef.aggregate({
      _max: { sortOrder: true },
    });
    const code = `custom_${Date.now().toString(36)}`;
    const created = await this.prisma.employeeProfileFieldDef.create({
      data: {
        code,
        label: dto.label.trim(),
        dataType: dto.dataType,
        options:
          dto.options === undefined
            ? Prisma.JsonNull
            : (dto.options as Prisma.InputJsonValue),
        required: dto.required ?? false,
        visible: dto.visible ?? true,
        isSystem: false,
        locked: false,
        storageKey: null,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
    });

    if (dto.tabIds?.length) {
      await this.replaceFieldTabs(created.id, dto.tabIds);
    }

    return this.getLayout();
  }

  async updateField(id: string, dto: UpdateProfileFieldDto) {
    const field = await this.prisma.employeeProfileFieldDef.findUnique({
      where: { id },
    });
    if (!field) throw new NotFoundException('Trường không tồn tại');

    if (field.locked) {
      if (dto.required === false || dto.visible === false) {
        throw new BadRequestException(
          'Không thể ẩn/bỏ bắt buộc trường hệ thống khóa',
        );
      }
    }

    const nextType = dto.dataType ?? (field.dataType as EmployeeProfileFieldDataType);
    if (dto.dataType !== undefined || dto.options !== undefined) {
      this.assertFieldOptions(
        nextType,
        dto.options === undefined
          ? ((field.options as Record<string, unknown> | null) ?? undefined)
          : dto.options ?? undefined,
      );
    }

    if (
      field.isSystem &&
      dto.dataType !== undefined &&
      dto.dataType !== field.dataType
    ) {
      throw new BadRequestException('Không đổi kiểu dữ liệu của trường hệ thống');
    }

    await this.prisma.employeeProfileFieldDef.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.dataType !== undefined && !field.isSystem
          ? { dataType: dto.dataType }
          : {}),
        ...(dto.options !== undefined
          ? {
              options:
                dto.options === null
                  ? Prisma.JsonNull
                  : (dto.options as Prisma.InputJsonValue),
            }
          : {}),
        ...(dto.required !== undefined
          ? { required: field.locked ? true : dto.required }
          : {}),
        ...(dto.visible !== undefined
          ? { visible: field.locked ? true : dto.visible }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    if (dto.tabIds !== undefined) {
      await this.replaceFieldTabs(id, dto.tabIds);
    }

    return this.getLayout();
  }

  async deleteField(id: string) {
    const field = await this.prisma.employeeProfileFieldDef.findUnique({
      where: { id },
    });
    if (!field) throw new NotFoundException('Trường không tồn tại');
    if (field.isSystem || field.locked) {
      throw new BadRequestException('Không thể xóa trường hệ thống');
    }
    await this.prisma.employeeProfileFieldDef.delete({ where: { id } });
    return this.getLayout();
  }

  async attachFieldToTab(tabId: string, dto: AttachFieldToTabDto) {
    const tab = await this.prisma.employeeProfileTab.findUnique({
      where: { id: tabId },
    });
    if (!tab) throw new NotFoundException('Tab không tồn tại');
    const field = await this.prisma.employeeProfileFieldDef.findUnique({
      where: { id: dto.fieldDefId },
    });
    if (!field) throw new NotFoundException('Trường không tồn tại');

    const max = await this.prisma.employeeProfileTabField.aggregate({
      where: { tabId },
      _max: { sortOrder: true },
    });

    await this.prisma.employeeProfileTabField.upsert({
      where: {
        tabId_fieldDefId: { tabId, fieldDefId: dto.fieldDefId },
      },
      create: {
        tabId,
        fieldDefId: dto.fieldDefId,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      update: {
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.getLayout();
  }

  async detachFieldFromTab(tabId: string, fieldDefId: string) {
    const link = await this.prisma.employeeProfileTabField.findUnique({
      where: { tabId_fieldDefId: { tabId, fieldDefId } },
      include: { fieldDef: true },
    });
    if (!link) throw new NotFoundException('Trường không thuộc tab');
    if (link.fieldDef.locked) {
      const otherLinks = await this.prisma.employeeProfileTabField.count({
        where: { fieldDefId, NOT: { tabId } },
      });
      if (otherLinks === 0) {
        throw new BadRequestException(
          'Không thể gỡ trường hệ thống khóa khỏi mọi tab',
        );
      }
    }
    await this.prisma.employeeProfileTabField.delete({
      where: { tabId_fieldDefId: { tabId, fieldDefId } },
    });
    return this.getLayout();
  }

  async reorderTabFields(tabId: string, fieldDefIds: string[]) {
    const links = await this.prisma.employeeProfileTabField.findMany({
      where: { tabId },
    });
    if (
      fieldDefIds.length !== links.length ||
      new Set(fieldDefIds).size !== fieldDefIds.length
    ) {
      throw new BadRequestException('Danh sách trường tab không hợp lệ');
    }
    const have = new Set(links.map((l) => l.fieldDefId));
    for (const id of fieldDefIds) {
      if (!have.has(id)) {
        throw new BadRequestException('Trường không thuộc tab');
      }
    }
    await this.prisma.$transaction(
      fieldDefIds.map((fieldDefId, sortOrder) =>
        this.prisma.employeeProfileTabField.update({
          where: { tabId_fieldDefId: { tabId, fieldDefId } },
          data: { sortOrder },
        }),
      ),
    );
    return this.getLayout();
  }

  async getRequiredVisibleKeys() {
    const defs = await this.prisma.employeeProfileFieldDef.findMany({
      where: { visible: true, required: true },
    });
    const scalarBuiltin: string[] = [];
    const customCodes: string[] = [];
    const sectionKeys: string[] = [];

    for (const def of defs) {
      if (def.dataType === EmployeeProfileFieldDataType.SECTION) {
        sectionKeys.push(def.code);
        continue;
      }
      if (def.storageKey) {
        scalarBuiltin.push(def.storageKey);
      } else {
        customCodes.push(def.code);
      }
    }

    return {
      scalarKeys: scalarBuiltin,
      customCodes,
      sectionKeys,
      visibleKeys: new Set(
        (
          await this.prisma.employeeProfileFieldDef.findMany({
            where: { visible: true },
            select: { code: true },
          })
        ).map((d) => d.code),
      ),
    };
  }

  private async replaceFieldTabs(fieldDefId: string, tabIds: string[]) {
    const unique = [...new Set(tabIds)];
    if (unique.length) {
      const tabs = await this.prisma.employeeProfileTab.findMany({
        where: { id: { in: unique } },
        select: { id: true },
      });
      if (tabs.length !== unique.length) {
        throw new BadRequestException('Có tab không tồn tại');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeProfileTabField.deleteMany({ where: { fieldDefId } });
      for (const [index, tabId] of unique.entries()) {
        await tx.employeeProfileTabField.create({
          data: { tabId, fieldDefId, sortOrder: index },
        });
      }
    });
  }

  private assertFieldOptions(
    dataType: EmployeeProfileFieldDataType,
    options?: Record<string, unknown> | null,
  ) {
    if (
      dataType === EmployeeProfileFieldDataType.SELECT ||
      dataType === EmployeeProfileFieldDataType.MULTISELECT
    ) {
      const choices = options?.choices;
      if (!Array.isArray(choices) || choices.length === 0) {
        throw new BadRequestException('SELECT/MULTISELECT cần options.choices');
      }
    }
    if (dataType === EmployeeProfileFieldDataType.SECTION) {
      const kind = options?.sectionKind;
      if (kind !== 'family' && kind !== 'education' && kind !== 'work') {
        throw new BadRequestException(
          'SECTION cần options.sectionKind = family|education|work',
        );
      }
    }
  }

  private mapField(
    field: {
      id: string;
      code: string;
      label: string;
      dataType: string;
      options: Prisma.JsonValue | null;
      required: boolean;
      visible: boolean;
      locked: boolean;
      isSystem: boolean;
      storageKey: string | null;
      sortOrder: number;
    },
    sortOrderOverride?: number,
    tabIds: string[] = [],
  ): ProfileLayoutField {
    return {
      id: field.id,
      code: field.code,
      label: field.label,
      dataType: field.dataType as EmployeeProfileFieldDataType,
      options: (field.options as ProfileFieldOptions | null) ?? null,
      required: field.required,
      visible: field.visible,
      locked: field.locked,
      isSystem: field.isSystem,
      storageKey: field.storageKey,
      sortOrder: sortOrderOverride ?? field.sortOrder,
      tabIds,
    };
  }
}
