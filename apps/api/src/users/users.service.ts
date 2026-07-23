import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PositionPermissionsService } from '../organization/position-permissions.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userInclude = {
  linkedEmployeeProfile: {
    select: {
      profileCode: true,
      fullName: true,
      phone: true,
      email: true,
      workPresenceStatus: true,
      managingCompany: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async findAll(
    page: number,
    pageSize: number,
    search?: string,
    hasLinkedProfile?: boolean,
  ) {
    const where = {
      ...(hasLinkedProfile
        ? { linkedEmployeeProfileId: { not: null } }
        : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { fullName: { contains: search, mode: 'insensitive' as const } },
              {
                accountCode: { contains: search, mode: 'insensitive' as const },
              },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: userInclude,
      }),
      this.prisma.user.count({ where }),
    ]);

    const positionCodesByUser = await this.loadPositionCodes(
      items.map((u) => u.id),
    );

    return {
      items: items.map((u) =>
        this.toResponse(u, positionCodesByUser.get(u.id) ?? []),
      ),
      total,
      page,
      pageSize,
    };
  }

  async findAvailableEmployeeProfiles() {
    return this.prisma.employeeProfile.findMany({
      where: {
        linkedUser: { is: null },
      },
      orderBy: { profileCode: 'asc' },
      select: {
        id: true,
        profileCode: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const codes = await this.loadPositionCodes([user.id]);
    return this.toResponse(user, codes.get(user.id) ?? []);
  }

  async create(dto: CreateUserDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeProfileId },
      include: { linkedUser: true },
    });
    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }
    if (profile.linkedUser) {
      throw new ConflictException('Hồ sơ đã được liên kết với tài khoản khác');
    }

    const phone = this.normalizePhone(profile.phone);
    if (phone.length < 8) {
      throw new BadRequestException(
        'Số điện thoại hồ sơ phải có ít nhất 8 chữ số',
      );
    }
    await this.authService.ensurePhoneAvailable(phone);
    if (profile.email) {
      await this.authService.ensureEmailAvailable(profile.email);
    }

    const profileCodeMatch = /^HS-(\d{5})$/.exec(profile.profileCode);
    if (!profileCodeMatch) {
      throw new BadRequestException('Mã hồ sơ nhân viên không hợp lệ');
    }
    const accountCode = `TK-${profileCodeMatch[1]}`;
    const accountCodeExists = await this.prisma.user.findUnique({
      where: { accountCode },
      select: { id: true },
    });
    if (accountCodeExists) {
      throw new ConflictException(
        `Mã tài khoản ${accountCode} đã được sử dụng`,
      );
    }
    const defaultPassword = phone.slice(-8);
    const passwordHash = await this.authService.hashPassword(defaultPassword);

    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        fullName: profile.fullName,
        accountCode,
        phone,
        passwordHash,
        linkedEmployeeProfileId: profile.id,
        mustChangePassword: true,
      },
      include: userInclude,
    });

    const codes = await this.loadPositionCodes([user.id]);
    return this.toResponse(user, codes.get(user.id) ?? []);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    const isSuperAdmin = existing.isSuperAdmin;

    if (isSuperAdmin && dto.isActive === false) {
      throw new BadRequestException(
        'Cannot deactivate the Super Admin account',
      );
    }

    if (dto.employeeProfileId) {
      if (existing.linkedEmployeeProfileId) {
        throw new BadRequestException('Tài khoản đã gắn hồ sơ liên kết');
      }
      const profile = await this.prisma.employeeProfile.findUnique({
        where: { id: dto.employeeProfileId },
        include: { linkedUser: { select: { id: true } } },
      });
      if (!profile) {
        throw new NotFoundException('Employee profile not found');
      }
      if (profile.linkedUser) {
        throw new ConflictException(
          'Hồ sơ đã được liên kết với tài khoản khác',
        );
      }
    }

    const nextPhone =
      dto.phone !== undefined
        ? dto.phone
          ? this.normalizePhone(dto.phone)
          : null
        : undefined;
    const nextEmail =
      dto.email !== undefined
        ? dto.email
          ? dto.email.toLowerCase()
          : null
        : undefined;

    if (nextEmail) {
      await this.authService.ensureEmailAvailable(nextEmail, id);
    }
    if (nextPhone) {
      await this.authService.ensurePhoneAvailable(nextPhone, id);
    }

    if (existing.linkedEmployeeProfileId) {
      if (nextPhone) {
        const phoneTaken = await this.prisma.employeeProfile.findFirst({
          where: {
            phone: nextPhone,
            id: { not: existing.linkedEmployeeProfileId },
          },
          select: { id: true },
        });
        if (phoneTaken) {
          throw new ConflictException(
            'Số điện thoại đã tồn tại trên hồ sơ nhân viên khác',
          );
        }
      }
      if (nextEmail) {
        const emailTaken = await this.prisma.employeeProfile.findFirst({
          where: {
            email: nextEmail,
            id: { not: existing.linkedEmployeeProfileId },
          },
          select: { id: true },
        });
        if (emailTaken) {
          throw new ConflictException(
            'Email đã tồn tại trên hồ sơ nhân viên khác',
          );
        }
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(nextEmail !== undefined ? { email: nextEmail } : {}),
          ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.password
            ? {
                passwordHash: await this.authService.hashPassword(dto.password),
              }
            : {}),
          ...(dto.employeeProfileId
            ? { linkedEmployeeProfileId: dto.employeeProfileId }
            : {}),
        },
        include: userInclude,
      });

      if (
        existing.linkedEmployeeProfileId &&
        (dto.fullName !== undefined ||
          nextPhone !== undefined ||
          nextEmail !== undefined)
      ) {
        await tx.employeeProfile.update({
          where: { id: existing.linkedEmployeeProfileId },
          data: {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
            ...(nextPhone !== undefined && nextPhone
              ? { phone: nextPhone }
              : {}),
            ...(nextEmail !== undefined ? { email: nextEmail } : {}),
          },
        });
      }

      return updated;
    });

    const codes = await this.loadPositionCodes([user.id]);
    return this.toResponse(user, codes.get(user.id) ?? []);
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('Account not found');
    }
    if (user.isSuperAdmin) {
      throw new BadRequestException('Cannot delete the Super Admin account');
    }
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async getPermissions(id: string) {
    await this.findOne(id);
    const auth = await this.positionPermissions.resolveAuthContext(id);
    const allPermissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    const grouped: Record<string, typeof allPermissions> = {};
    for (const permission of allPermissions) {
      grouped[permission.module] ??= [];
      grouped[permission.module].push(permission);
    }

    return {
      isSystemAdmin: auth.isSystemAdmin,
      permissions: grouped,
      effectivePermissionCodes: auth.permissions,
      orgScopes: auth.orgScopes,
      note: auth.isSystemAdmin
        ? 'Super Admin có toàn quyền hệ thống theo mặc định và không thể thay đổi.'
        : 'Quyền hiệu lực chỉ từ nhóm quyền gắn vị trí trên cây tổ chức. Tài khoản chưa gắn vị trí (hoặc vị trí chưa có nhóm quyền) sẽ không có quyền nghiệp vụ.',
    };
  }

  private async loadPositionCodes(
    userIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (userIds.length === 0) return map;

    const push = (userId: string | null | undefined, code: string | null) => {
      if (!userId || !code) return;
      const list = map.get(userId) ?? [];
      if (!list.includes(code)) list.push(code);
      map.set(userId, list);
    };

    const [orgs, companies, units, orgMembers, companyMembers, unitMembers] =
      await Promise.all([
        this.prisma.organization.findMany({
          where: { linkedProfileUserId: { in: userIds } },
          select: { linkedProfileUserId: true, positionCode: true },
        }),
        this.prisma.company.findMany({
          where: { linkedProfileUserId: { in: userIds } },
          select: { linkedProfileUserId: true, positionCode: true },
        }),
        this.prisma.organizationUnit.findMany({
          where: { linkedProfileUserId: { in: userIds } },
          select: { linkedProfileUserId: true, positionCode: true },
        }),
        this.prisma.organizationMember.findMany({
          where: { linkedProfileUserId: { in: userIds } },
          select: { linkedProfileUserId: true, positionCode: true },
        }),
        this.prisma.companyMember.findMany({
          where: { linkedProfileUserId: { in: userIds } },
          select: { linkedProfileUserId: true, positionCode: true },
        }),
        this.prisma.organizationUnitMember.findMany({
          where: { linkedProfileUserId: { in: userIds } },
          select: { linkedProfileUserId: true, positionCode: true },
        }),
      ]);

    for (const row of orgs) push(row.linkedProfileUserId, row.positionCode);
    for (const row of companies)
      push(row.linkedProfileUserId, row.positionCode);
    for (const row of units) push(row.linkedProfileUserId, row.positionCode);
    for (const row of orgMembers)
      push(row.linkedProfileUserId, row.positionCode);
    for (const row of companyMembers)
      push(row.linkedProfileUserId, row.positionCode);
    for (const row of unitMembers)
      push(row.linkedProfileUserId, row.positionCode);

    for (const [, codes] of map) codes.sort();
    return map;
  }

  private toResponse(
    user: {
      id: string;
      email: string | null;
      fullName: string;
      isActive: boolean;
      accountCode: string;
      phone: string | null;
      linkedEmployeeProfileId: string | null;
      mustChangePassword: boolean;
      isSuperAdmin: boolean;
      createdAt: Date;
      updatedAt: Date;
      linkedEmployeeProfile?: {
        profileCode: string;
        fullName: string;
        phone: string;
        email: string | null;
        workPresenceStatus: string;
        managingCompany: { name: string } | null;
      } | null;
    },
    positionCodes: string[] = [],
  ) {
    const isSuperAdmin = user.isSuperAdmin;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      accountCode: user.accountCode,
      phone: user.phone,
      linkedEmployeeProfileId: user.linkedEmployeeProfileId,
      positionCodes,
      linkedEmployeeProfile: user.linkedEmployeeProfile
        ? {
            profileCode: user.linkedEmployeeProfile.profileCode,
            fullName: user.linkedEmployeeProfile.fullName,
            phone: user.linkedEmployeeProfile.phone,
            email: user.linkedEmployeeProfile.email,
            workPresenceStatus: user.linkedEmployeeProfile.workPresenceStatus,
          }
        : null,
      mustChangePassword: user.mustChangePassword,
      isSuperAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }
}
