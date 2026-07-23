import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeProfileStatus,
  EmployeeWorkPresenceStatus,
  FamilyRelationship,
  AUTO_LIFECYCLE_STATUSES,
  HR_EMPLOYEE_STATUS_TRANSITIONS,
} from '@erp/shared';
import {
  EmployeeProfileEditRequestStatus,
  EmployeeProfileStatus as PrismaEmployeeProfileStatus,
  EntityStatus,
  Prisma,
} from '@prisma/client';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeProfileSettingsService } from './employee-profile-settings.service';
import {
  CheckOrCreateEmployeeDto,
  CreateEducationHistoryDto,
  CreateEmployeeDto,
  CreateFamilyMemberDto,
  CreateWorkHistoryDto,
  EmployeeBaseDto,
  EmployeeCollectionQueryDto,
  EmployeeQueryDto,
  ReorderChildrenDto,
  UpdateEducationHistoryDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
  UpdateFamilyMemberDto,
  UpdateWorkHistoryDto,
  UploadEmployeeDocumentDto,
} from './dto/employee.dto';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
};

/** Ma trận chuyển trạng thái do HR xác thực / khóa. */
const HR_STATUS_TRANSITIONS = HR_EMPLOYEE_STATUS_TRANSITIONS;

const profileInclude = {
  linkedUser: {
    select: {
      id: true,
      accountCode: true,
      email: true,
      fullName: true,
    },
  },
  managingCompany: {
    select: { id: true, name: true, status: true },
  },
  familyMembers: { orderBy: { sortOrder: 'asc' as const } },
  educationHistories: { orderBy: { sortOrder: 'asc' as const } },
  workHistories: { orderBy: { sortOrder: 'asc' as const } },
  documents: { orderBy: { createdAt: 'desc' as const } },
  customFieldValues: {
    include: {
      fieldDef: { select: { id: true, code: true, storageKey: true } },
    },
  },
  editRequests: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      requestedBy: { select: { id: true, fullName: true, accountCode: true } },
      reviewedBy: { select: { id: true, fullName: true, accountCode: true } },
    },
  },
} as const;

type TxClient = Prisma.TransactionClient;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly profileSettings: EmployeeProfileSettingsService,
  ) {}

  async findAll(query: EmployeeQueryDto) {
    const search = query.search?.trim();
    const statusFilter =
      query.statusIn?.length
        ? { status: { in: query.statusIn as PrismaEmployeeProfileStatus[] } }
        : query.status
          ? { status: query.status as PrismaEmployeeProfileStatus }
          : {};
    const employmentFilter = query.employmentStatusIn?.length
      ? { employmentStatus: { in: query.employmentStatusIn } }
      : {};
    const workPresenceFilter = query.workPresenceStatusIn?.length
      ? { workPresenceStatus: { in: query.workPresenceStatusIn } }
      : {};
    const companyFilter = query.managingCompanyIdIn?.length
      ? { managingCompanyId: { in: query.managingCompanyIdIn } }
      : {};
    const where: Prisma.EmployeeProfileWhereInput = {
      deletedAt: null,
      ...statusFilter,
      ...employmentFilter,
      ...workPresenceFilter,
      ...companyFilter,
      ...(search
        ? {
            OR: [
              { profileCode: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { identityNumber: { contains: search, mode: 'insensitive' } },
              {
                managingCompany: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          profileCode: true,
          fullName: true,
          phone: true,
          email: true,
          gender: true,
          birthDate: true,
          avatarUrl: true,
          status: true,
          employmentStatus: true,
          workPresenceStatus: true,
          createdAt: true,
          managingCompanyId: true,
          managingCompany: {
            select: { id: true, name: true },
          },
          linkedUser: {
            select: { id: true, accountCode: true, email: true, fullName: true },
          },
          editRequests: {
            where: { status: EmployeeProfileEditRequestStatus.PENDING },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, reason: true, status: true, createdAt: true },
          },
        },
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    return this.getProfile(id);
  }

  private async getProfile(id: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: profileInclude,
    });
    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }
    return this.serializeProfile(profile);
  }

  private serializeProfile<
    T extends {
      customFieldValues?: Array<{
        value: Prisma.JsonValue;
        fieldDef: { code: string };
      }>;
    },
  >(profile: T) {
    const { customFieldValues, ...rest } = profile;
    const customValues: Record<string, unknown> = {};
    for (const row of customFieldValues ?? []) {
      customValues[row.fieldDef.code] = row.value;
    }
    return { ...rest, customValues };
  }

  private async upsertCustomValues(
    tx: TxClient,
    profileId: string,
    customValues: Record<string, unknown> | undefined,
  ) {
    if (!customValues) return;
    const codes = Object.keys(customValues);
    if (codes.length === 0) return;
    const defs = await tx.employeeProfileFieldDef.findMany({
      where: { code: { in: codes }, storageKey: null },
    });
    const byCode = new Map(defs.map((d) => [d.code, d]));
    for (const [code, value] of Object.entries(customValues)) {
      const def = byCode.get(code);
      if (!def) {
        throw new BadRequestException(`Trường custom không hợp lệ: ${code}`);
      }
      if (value === null || value === undefined || value === '') {
        await tx.employeeProfileFieldValue.deleteMany({
          where: { profileId, fieldDefId: def.id },
        });
        continue;
      }
      await tx.employeeProfileFieldValue.upsert({
        where: {
          profileId_fieldDefId: { profileId, fieldDefId: def.id },
        },
        create: {
          profileId,
          fieldDefId: def.id,
          value: value as Prisma.InputJsonValue,
        },
        update: { value: value as Prisma.InputJsonValue },
      });
    }
  }

  async create(dto: CreateEmployeeDto) {
    if (!dto.fullName?.trim()) {
      throw new BadRequestException('Họ tên là bắt buộc');
    }
    if (!dto.phone || !/^\d{10,11}$/.test(this.normalizePhone(dto.phone))) {
      throw new BadRequestException('Số điện thoại phải gồm 10-11 chữ số');
    }
    await this.validateProfilePayload(dto);
    const phone = this.normalizePhone(dto.phone);
    await this.ensurePhoneAvailable(phone);

    if (dto.email) {
      await this.ensureEmailUnique(this.normalizeEmail(dto.email));
    }
    if (dto.identityNumber) {
      await this.ensureIdentityUnique(dto.identityNumber.trim());
    }

    await this.ensureManagingCompanyAssignable(dto.managingCompanyId);

    if (dto.linkedUserId) {
      await this.ensureUserCanLink(dto.linkedUserId);
      await this.ensureLinkedUserFieldsAvailable(
        dto.linkedUserId,
        phone,
        dto.email ? this.normalizeEmail(dto.email) : null,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const profileCode = await this.allocateProfileCode(tx);
        const profile = await tx.employeeProfile.create({
          data: this.toCreateScalarData(dto, profileCode),
        });
        await this.upsertCustomValues(tx, profile.id, dto.customValues);
        if (dto.linkedUserId) {
          await this.syncLinkedUser(tx, dto.linkedUserId, profile.id, profile);
        }
        return profile.id;
      }).then((id) => this.getProfile(id));
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async checkOrCreate(dto: CheckOrCreateEmployeeDto) {
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.prisma.employeeProfile.findFirst({
      where: { phone, deletedAt: null },
      include: profileInclude,
    });
    if (existing) {
      return {
        created: false as const,
        profile: this.serializeProfile(existing),
      };
    }

    const company = await this.ensureManagingCompanyAssignable(
      dto.managingCompanyId,
    );

    try {
      const profileId = await this.prisma.$transaction(async (tx) => {
        const profileCode = await this.allocateProfileCode(tx);
        const created = await tx.employeeProfile.create({
          data: {
            profileCode,
            fullName: this.normalizeName(dto.fullName),
            phone,
            managingCompanyId: company.id,
            status: PrismaEmployeeProfileStatus.INCOMPLETE,
          },
        });
        return created.id;
      });
      return {
        created: true as const,
        profile: await this.getProfile(profileId),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.employeeProfile.findFirst({
          where: { phone, deletedAt: null },
          include: profileInclude,
        });
        if (raced) {
          return {
            created: false as const,
            profile: this.serializeProfile(raced),
          };
        }
      }
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: { linkedUser: { select: { id: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Employee profile not found');
    }
    if (
      existing.status === PrismaEmployeeProfileStatus.LOCKED ||
      existing.status === PrismaEmployeeProfileStatus.EDIT_REQUESTED
    ) {
      throw new BadRequestException(
        existing.status === PrismaEmployeeProfileStatus.LOCKED
          ? 'Hồ sơ đang khóa, không thể chỉnh sửa'
          : 'Hồ sơ đang chờ duyệt yêu cầu chỉnh sửa, không thể cập nhật nội dung',
      );
    }

    await this.validateProfilePayload(dto, existing);

    if (dto.phone !== undefined) {
      await this.ensurePhoneAvailable(this.normalizePhone(dto.phone), id);
    }
    if (dto.email !== undefined && dto.email) {
      await this.ensureEmailUnique(this.normalizeEmail(dto.email), id);
    }
    if (dto.identityNumber !== undefined && dto.identityNumber) {
      await this.ensureIdentityUnique(dto.identityNumber.trim(), id);
    }

    if (dto.managingCompanyId !== undefined) {
      if (!dto.managingCompanyId) {
        throw new BadRequestException('Công ty chủ quản là bắt buộc');
      }
      await this.ensureManagingCompanyAssignable(dto.managingCompanyId);
    }

    if (dto.linkedUserId) {
      await this.ensureUserCanLink(dto.linkedUserId, id);
    }
    const targetUserId =
      dto.linkedUserId !== undefined
        ? dto.linkedUserId || null
        : existing.linkedUser?.id ?? null;

    const nextPhone = dto.phone
      ? this.normalizePhone(dto.phone)
      : existing.phone;
    const nextEmail =
      dto.email !== undefined
        ? dto.email
          ? this.normalizeEmail(dto.email)
          : null
        : existing.email;
    if (targetUserId) {
      await this.ensureLinkedUserFieldsAvailable(
        targetUserId,
        nextPhone,
        nextEmail,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.employeeProfile.update({
          where: { id },
          data: this.toUpdateScalarData(dto),
        });

        await this.upsertCustomValues(tx, id, dto.customValues);

        if (
          dto.linkedUserId !== undefined &&
          existing.linkedUser &&
          existing.linkedUser.id !== dto.linkedUserId
        ) {
          await tx.user.update({
            where: { id: existing.linkedUser.id },
            data: { linkedEmployeeProfileId: null },
          });
        }

        if (targetUserId) {
          await this.syncLinkedUser(tx, targetUserId, id, updated);
        }

        return id;
      }).then(async (profileId) => {
        await this.syncLifecycleStatusAfterSave(profileId);
        return this.getProfile(profileId);
      });
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async complete(id: string) {
    // Giữ endpoint tương thích: đồng bộ lifecycle giống lúc Lưu hồ sơ.
    await this.ensureProfileExists(id);
    await this.syncLifecycleStatusAfterSave(id);
    const profile = await this.getProfile(id);
    if (profile.status !== EmployeeProfileStatus.PENDING_REVIEW) {
      const missing = await this.getCompletionGaps(id);
      throw new BadRequestException({
        message: 'Hồ sơ chưa đủ dữ liệu bắt buộc để chuyển Chờ xác nhận',
        missing,
      });
    }
    return profile;
  }

  async updateStatus(id: string, dto: UpdateEmployeeStatusDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }

    const from = profile.status as EmployeeProfileStatus;
    const to = dto.status;
    if (from === to) {
      return this.findOne(id);
    }

    const allowed = HR_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${from} sang ${to}`,
      );
    }

    return this.prisma.employeeProfile.update({
      where: { id },
      data: { status: to as PrismaEmployeeProfileStatus },
      include: profileInclude,
    });
  }

  async listEditRequests(status?: string) {
    return this.prisma.employeeProfileEditRequest.findMany({
      where: status
        ? { status: status as EmployeeProfileEditRequestStatus }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        employeeProfile: {
          select: {
            id: true,
            profileCode: true,
            fullName: true,
            status: true,
            avatarUrl: true,
          },
        },
        requestedBy: { select: { id: true, fullName: true, accountCode: true } },
        reviewedBy: { select: { id: true, fullName: true, accountCode: true } },
      },
    });
  }

  async approveEditRequest(
    requestId: string,
    reviewerId: string,
    reviewNote?: string,
  ) {
    return this.reviewEditRequest(
      requestId,
      reviewerId,
      EmployeeProfileEditRequestStatus.APPROVED,
      reviewNote,
    );
  }

  async rejectEditRequest(
    requestId: string,
    reviewerId: string,
    reviewNote?: string,
  ) {
    return this.reviewEditRequest(
      requestId,
      reviewerId,
      EmployeeProfileEditRequestStatus.REJECTED,
      reviewNote,
    );
  }

  private async reviewEditRequest(
    requestId: string,
    reviewerId: string,
    decision: EmployeeProfileEditRequestStatus,
    reviewNote?: string,
  ) {
    const request = await this.prisma.employeeProfileEditRequest.findUnique({
      where: { id: requestId },
      select: { id: true, employeeProfileId: true, status: true },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu chỉnh sửa');
    }
    if (request.status !== EmployeeProfileEditRequestStatus.PENDING) {
      throw new ConflictException('Yêu cầu chỉnh sửa đã được xử lý');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.employeeProfileEditRequest.updateMany({
        where: {
          id: requestId,
          status: EmployeeProfileEditRequestStatus.PENDING,
        },
        data: {
          status: decision,
          reviewedByUserId: reviewerId,
          reviewNote: reviewNote?.trim() || null,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Yêu cầu chỉnh sửa đã được xử lý');
      }

      if (decision === EmployeeProfileEditRequestStatus.APPROVED) {
        await tx.employeeProfile.update({
          where: { id: request.employeeProfileId },
          data: { status: PrismaEmployeeProfileStatus.NEEDS_ADJUSTMENT },
        });
      } else if (decision === EmployeeProfileEditRequestStatus.REJECTED) {
        await tx.employeeProfile.update({
          where: { id: request.employeeProfileId },
          data: { status: PrismaEmployeeProfileStatus.VERIFIED },
        });
      }

      return tx.employeeProfileEditRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          employeeProfile: {
            select: { id: true, profileCode: true, fullName: true, status: true },
          },
          requestedBy: { select: { id: true, fullName: true, accountCode: true } },
          reviewedBy: { select: { id: true, fullName: true, accountCode: true } },
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employeeProfile.update({
      where: { id },
      data: {
        status: PrismaEmployeeProfileStatus.LOCKED,
        deletedAt: new Date(),
      },
      include: profileInclude,
    });
  }

  async hardDelete(id: string) {
    // Chỉ chặn production. Dev/local thường để trống NODE_ENV khi chạy nest watch.
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Chỉ được phép xóa cứng hồ sơ trong môi trường development',
      );
    }

    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      select: { id: true, profileCode: true, avatarUrl: true },
    });
    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }

    await this.prisma.employeeProfile.delete({ where: { id } });
    await this.deleteAvatarFiles(id);
    await rm(this.documentDir(id), { recursive: true, force: true });
    return { success: true, profileCode: profile.profileCode };
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    await this.ensureProfileExists(id);
    if (!file?.buffer?.length) {
      throw new BadRequestException('File ảnh không hợp lệ');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Ảnh đại diện tối đa 2MB');
    }
    const ext = AVATAR_MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
    }

    const dir = this.avatarDir(id);
    await this.deleteAvatarFiles(id);
    await mkdir(dir, { recursive: true });

    const fileName = `avatar${ext}`;
    const absolutePath = join(dir, fileName);
    await writeFile(absolutePath, file.buffer);

    const avatarUrl = `/uploads/employees/${id}/${fileName}`;
    return this.prisma.employeeProfile.update({
      where: { id },
      data: { avatarUrl },
      include: profileInclude,
    });
  }

  async removeAvatar(id: string) {
    await this.ensureProfileExists(id);
    await this.deleteAvatarFiles(id);
    return this.prisma.employeeProfile.update({
      where: { id },
      data: { avatarUrl: null },
      include: profileInclude,
    });
  }

  async listDocuments(employeeId: string) {
    await this.ensureProfileExists(employeeId);
    return this.prisma.employeeDocument.findMany({
      where: { employeeProfileId: employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(
    employeeId: string,
    dto: UploadEmployeeDocumentDto,
    file: Express.Multer.File,
  ) {
    await this.ensureProfileExists(employeeId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('File giấy tờ không hợp lệ');
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException('File giấy tờ tối đa 10MB');
    }
    const ext = DOCUMENT_MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Chỉ hỗ trợ file PDF, JPG, PNG, DOC hoặc DOCX',
      );
    }

    const documentId = randomUUID();
    const fileName = `${documentId}${ext}`;
    const dir = this.documentDir(employeeId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, fileName), file.buffer);

    try {
      return await this.prisma.employeeDocument.create({
        data: {
          id: documentId,
          employeeProfileId: employeeId,
          documentType: dto.documentType,
          name: dto.name.trim(),
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          fileUrl: `/uploads/employee-documents/${employeeId}/${fileName}`,
        },
      });
    } catch (error) {
      await rm(join(dir, fileName), { force: true });
      throw error;
    }
  }

  async deleteDocument(employeeId: string, documentId: string) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, employeeProfileId: employeeId },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy giấy tờ');
    }
    await this.prisma.employeeDocument.delete({ where: { id: documentId } });
    const fileName = document.fileUrl.split('/').pop();
    if (fileName) {
      await rm(join(this.documentDir(employeeId), fileName), { force: true });
    }
    return { success: true };
  }

  private uploadsRoot() {
    // nest chạy từ apps/api → monorepo root là ../..
    return resolve(process.cwd(), '../..', 'uploads');
  }

  private avatarDir(employeeId: string) {
    return join(this.uploadsRoot(), 'employees', employeeId);
  }

  private documentDir(employeeId: string) {
    return join(this.uploadsRoot(), 'employee-documents', employeeId);
  }

  private async deleteAvatarFiles(employeeId: string) {
    const dir = this.avatarDir(employeeId);
    if (!existsSync(dir)) return;
    await rm(dir, { recursive: true, force: true });
  }

  async listFamilyMembers(employeeId: string, query: EmployeeCollectionQueryDto) {
    await this.ensureProfileExists(employeeId);
    const search = query.search?.trim();
    const where: Prisma.EmployeeFamilyMemberWhereInput = {
      employeeProfileId: employeeId,
      ...(search
        ? {
            OR: [
              { relationship: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { occupation: { contains: search, mode: 'insensitive' } },
              { workplace: { contains: search, mode: 'insensitive' } },
              { currentResidence: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.employeeFamilyMember.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeFamilyMember.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createFamilyMember(employeeId: string, dto: CreateFamilyMemberDto) {
    await this.ensureProfileExists(employeeId);
    await this.ensureFamilyRelationshipUnique(employeeId, dto.relationship);
    return this.prisma.employeeFamilyMember.create({
      data: {
        employeeProfileId: employeeId,
        relationship: dto.relationship,
        fullName: this.normalizeName(dto.fullName),
        birthYear: dto.birthYear,
        occupation: this.optionalText(dto.occupation),
        workplace: this.optionalText(dto.workplace),
        currentResidence: this.optionalText(dto.currentResidence),
        sortOrder: await this.nextFamilySortOrder(employeeId),
      },
    });
  }

  async updateFamilyMember(
    employeeId: string,
    memberId: string,
    dto: UpdateFamilyMemberDto,
  ) {
    const existing = await this.getFamilyMemberOrThrow(employeeId, memberId);
    const relationship = dto.relationship ?? existing.relationship;
    await this.ensureFamilyRelationshipUnique(
      employeeId,
      relationship,
      memberId,
    );
    return this.prisma.employeeFamilyMember.update({
      where: { id: memberId },
      data: {
        ...(dto.relationship !== undefined
          ? { relationship: dto.relationship }
          : {}),
        ...(dto.fullName !== undefined
          ? { fullName: this.normalizeName(dto.fullName) }
          : {}),
        ...(dto.birthYear !== undefined ? { birthYear: dto.birthYear } : {}),
        ...(dto.occupation !== undefined
          ? { occupation: this.optionalText(dto.occupation) }
          : {}),
        ...(dto.workplace !== undefined
          ? { workplace: this.optionalText(dto.workplace) }
          : {}),
        ...(dto.currentResidence !== undefined
          ? { currentResidence: this.optionalText(dto.currentResidence) }
          : {}),
      },
    });
  }

  async deleteFamilyMember(employeeId: string, memberId: string) {
    await this.getFamilyMemberOrThrow(employeeId, memberId);
    await this.prisma.employeeFamilyMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async reorderFamilyMembers(employeeId: string, dto: ReorderChildrenDto) {
    await this.reorderFamilyMembersInternal(employeeId, dto.orderedIds);
    return this.listFamilyMembers(employeeId, new EmployeeCollectionQueryDto());
  }

  async listEducationHistories(
    employeeId: string,
    query: EmployeeCollectionQueryDto,
  ) {
    await this.ensureProfileExists(employeeId);
    const search = query.search?.trim();
    const where: Prisma.EmployeeEducationHistoryWhereInput = {
      employeeProfileId: employeeId,
      ...(search
        ? {
            OR: [
              { institution: { contains: search, mode: 'insensitive' } },
              { major: { contains: search, mode: 'insensitive' } },
              { degree: { contains: search, mode: 'insensitive' } },
              { trainingMode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.employeeEducationHistory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeEducationHistory.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createEducationHistory(
    employeeId: string,
    dto: CreateEducationHistoryDto,
  ) {
    await this.ensureProfileExists(employeeId);
    await this.validateEducationHistory(employeeId, dto);
    return this.prisma.employeeEducationHistory.create({
      data: {
        employeeProfileId: employeeId,
        fromMonth: this.toMonthDate(dto.fromMonth),
        toMonth: this.toMonthDate(dto.toMonth),
        institution: dto.institution.trim(),
        major: dto.major.trim(),
        trainingMode: dto.trainingMode,
        degree: dto.degree.trim(),
        sortOrder: await this.nextEducationSortOrder(employeeId),
      },
    });
  }

  async updateEducationHistory(
    employeeId: string,
    historyId: string,
    dto: UpdateEducationHistoryDto,
  ) {
    const existing = await this.getEducationHistoryOrThrow(
      employeeId,
      historyId,
    );
    const merged = {
      fromMonth: dto.fromMonth ?? this.toMonthString(existing.fromMonth),
      toMonth: dto.toMonth ?? this.toMonthString(existing.toMonth),
      institution: dto.institution ?? existing.institution,
      major: dto.major ?? existing.major,
      trainingMode: dto.trainingMode ?? existing.trainingMode,
      degree: dto.degree ?? existing.degree,
    };
    await this.validateEducationHistory(employeeId, merged, historyId);
    return this.prisma.employeeEducationHistory.update({
      where: { id: historyId },
      data: {
        ...(dto.fromMonth !== undefined
          ? { fromMonth: this.toMonthDate(dto.fromMonth) }
          : {}),
        ...(dto.toMonth !== undefined
          ? { toMonth: this.toMonthDate(dto.toMonth) }
          : {}),
        ...(dto.institution !== undefined
          ? { institution: dto.institution.trim() }
          : {}),
        ...(dto.major !== undefined ? { major: dto.major.trim() } : {}),
        ...(dto.trainingMode !== undefined
          ? { trainingMode: dto.trainingMode }
          : {}),
        ...(dto.degree !== undefined ? { degree: dto.degree.trim() } : {}),
      },
    });
  }

  async deleteEducationHistory(employeeId: string, historyId: string) {
    await this.getEducationHistoryOrThrow(employeeId, historyId);
    await this.prisma.employeeEducationHistory.delete({ where: { id: historyId } });
    return { success: true };
  }

  async reorderEducationHistories(employeeId: string, dto: ReorderChildrenDto) {
    await this.reorderEducationHistoriesInternal(employeeId, dto.orderedIds);
    return this.listEducationHistories(employeeId, new EmployeeCollectionQueryDto());
  }

  async listWorkHistories(employeeId: string, query: EmployeeCollectionQueryDto) {
    await this.ensureProfileExists(employeeId);
    const search = query.search?.trim();
    const where: Prisma.EmployeeWorkHistoryWhereInput = {
      employeeProfileId: employeeId,
      ...(search
        ? {
            OR: [
              { company: { contains: search, mode: 'insensitive' } },
              { department: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.employeeWorkHistory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeWorkHistory.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createWorkHistory(employeeId: string, dto: CreateWorkHistoryDto) {
    await this.ensureProfileExists(employeeId);
    await this.validateWorkHistory(employeeId, dto);
    return this.prisma.employeeWorkHistory.create({
      data: {
        employeeProfileId: employeeId,
        fromMonth: this.toMonthDate(dto.fromMonth),
        toMonth: dto.toMonth ? this.toMonthDate(dto.toMonth) : null,
        company: dto.company.trim(),
        department: this.optionalText(dto.department),
        position: dto.position.trim(),
        sortOrder: await this.nextWorkSortOrder(employeeId),
      },
    });
  }

  async updateWorkHistory(
    employeeId: string,
    historyId: string,
    dto: UpdateWorkHistoryDto,
  ) {
    const existing = await this.getWorkHistoryOrThrow(employeeId, historyId);
    const merged = {
      fromMonth: dto.fromMonth ?? this.toMonthString(existing.fromMonth),
      toMonth:
        dto.toMonth !== undefined
          ? dto.toMonth
          : existing.toMonth
            ? this.toMonthString(existing.toMonth)
            : undefined,
      company: dto.company ?? existing.company,
      department: dto.department ?? existing.department ?? undefined,
      position: dto.position ?? existing.position,
    };
    await this.validateWorkHistory(employeeId, merged, historyId);
    return this.prisma.employeeWorkHistory.update({
      where: { id: historyId },
      data: {
        ...(dto.fromMonth !== undefined
          ? { fromMonth: this.toMonthDate(dto.fromMonth) }
          : {}),
        ...(dto.toMonth !== undefined
          ? { toMonth: dto.toMonth ? this.toMonthDate(dto.toMonth) : null }
          : {}),
        ...(dto.company !== undefined ? { company: dto.company.trim() } : {}),
        ...(dto.department !== undefined
          ? { department: this.optionalText(dto.department) }
          : {}),
        ...(dto.position !== undefined
          ? { position: dto.position.trim() }
          : {}),
      },
    });
  }

  async deleteWorkHistory(employeeId: string, historyId: string) {
    await this.getWorkHistoryOrThrow(employeeId, historyId);
    await this.prisma.employeeWorkHistory.delete({ where: { id: historyId } });
    return { success: true };
  }

  async reorderWorkHistories(employeeId: string, dto: ReorderChildrenDto) {
    await this.reorderWorkHistoriesInternal(employeeId, dto.orderedIds);
    return this.listWorkHistories(employeeId, new EmployeeCollectionQueryDto());
  }

  private async allocateProfileCode(tx: TxClient) {
    while (true) {
      const [row] = await tx.$queryRaw<Array<{ seq: bigint }>>`
        SELECT nextval('employee_profile_code_seq') AS seq
      `;
      const suffix = row.seq.toString().padStart(5, '0');
      const matchingAccount = await tx.user.findUnique({
        where: { accountCode: `TK-${suffix}` },
        select: { id: true },
      });
      if (!matchingAccount) {
        return `HS-${suffix}`;
      }
    }
  }

  private async ensureProfileExists(id: string) {
    const exists = await this.prisma.employeeProfile.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Employee profile not found');
    }
  }

  private async ensureUserCanLink(userId: string, profileId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, linkedEmployeeProfileId: true },
    });
    if (!user) {
      throw new NotFoundException('Linked account not found');
    }
    if (
      user.linkedEmployeeProfileId &&
      user.linkedEmployeeProfileId !== profileId
    ) {
      throw new ConflictException(
        'Account is already linked to another employee profile',
      );
    }
  }

  private async ensureLinkedUserFieldsAvailable(
    userId: string,
    phone: string,
    email: string | null,
  ) {
    await this.authService.ensurePhoneAvailable(this.normalizePhone(phone), userId);
    if (email) {
      await this.authService.ensureEmailAvailable(this.normalizeEmail(email), userId);
    }
  }

  private async syncLinkedUser(
    tx: TxClient,
    userId: string,
    profileId: string,
    profile: { fullName: string; phone: string; email: string | null },
  ) {
    await tx.user.update({
      where: { id: userId },
      data: {
        linkedEmployeeProfileId: profileId,
        fullName: profile.fullName,
        phone: this.normalizePhone(profile.phone),
        ...(profile.email
          ? { email: this.normalizeEmail(profile.email) }
          : {}),
      },
    });
  }

  private async ensurePhoneAvailable(phone: string, excludeProfileId?: string) {
    const existing = await this.prisma.employeeProfile.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
    });
    if (existing && existing.id !== excludeProfileId) {
      throw new ConflictException('Số điện thoại đã tồn tại trên hệ thống');
    }
  }

  private async ensureEmailUnique(email: string, excludeProfileId?: string) {
    const existing = await this.prisma.employeeProfile.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });
    if (existing && existing.id !== excludeProfileId) {
      throw new ConflictException('Email đã tồn tại trên hệ thống');
    }
  }

  private async ensureIdentityUnique(
    identityNumber: string,
    excludeProfileId?: string,
  ) {
    const existing = await this.prisma.employeeProfile.findFirst({
      where: { identityNumber, deletedAt: null },
      select: { id: true },
    });
    if (existing && existing.id !== excludeProfileId) {
      throw new ConflictException('CCCD/CMND đã tồn tại trên hệ thống');
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('phone')) {
        throw new ConflictException('Số điện thoại đã tồn tại trên hệ thống');
      }
      if (target.includes('email')) {
        throw new ConflictException('Email đã tồn tại trên hệ thống');
      }
      if (target.includes('identity')) {
        throw new ConflictException('CCCD/CMND đã tồn tại trên hệ thống');
      }
      throw new ConflictException('Dữ liệu bị trùng');
    }
  }

  private async collectCompletionGaps(profile: Record<string, unknown> & {
    familyMembers: { id: string }[];
    educationHistories: { id: string }[];
    workHistories: { id: string }[];
    customFieldValues?: Array<{
      value: Prisma.JsonValue;
      fieldDef: { code: string };
    }>;
  }) {
    const { scalarKeys, customCodes, sectionKeys } =
      await this.profileSettings.getRequiredVisibleKeys();
    const missing: string[] = [];
    for (const field of scalarKeys) {
      const value = profile[field];
      if (value === null || value === undefined || value === '') {
        missing.push(field);
      }
    }
    const customByCode = new Map(
      (profile.customFieldValues ?? []).map((row) => [
        row.fieldDef.code,
        row.value,
      ]),
    );
    for (const code of customCodes) {
      const value = customByCode.get(code);
      if (value === null || value === undefined || value === '') {
        missing.push(code);
      }
    }
    if (sectionKeys.includes('section.family') && profile.familyMembers.length === 0) {
      missing.push('section.family');
    }
    if (
      sectionKeys.includes('section.education') &&
      profile.educationHistories.length === 0
    ) {
      missing.push('section.education');
    }
    if (sectionKeys.includes('section.work') && profile.workHistories.length === 0) {
      missing.push('section.work');
    }
    return missing;
  }

  /** Kiểm tra thiếu field bắt buộc (cho UI / API phụ). */
  async getCompletionGaps(id: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        familyMembers: { select: { id: true } },
        educationHistories: { select: { id: true } },
        workHistories: { select: { id: true } },
        customFieldValues: {
          include: { fieldDef: { select: { code: true } } },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }
    return this.collectCompletionGaps(profile);
  }

  /**
   * INCOMPLETE / NEEDS_ADJUSTMENT: đủ bắt buộc → PENDING_REVIEW, thiếu → INCOMPLETE.
   */
  private async syncLifecycleStatusAfterSave(id: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        familyMembers: { select: { id: true } },
        educationHistories: { select: { id: true } },
        workHistories: { select: { id: true } },
        customFieldValues: {
          include: { fieldDef: { select: { code: true } } },
        },
      },
    });
    if (!profile) return;

    const from = profile.status as EmployeeProfileStatus;
    if (!AUTO_LIFECYCLE_STATUSES.includes(from)) {
      return;
    }

    const missing = await this.collectCompletionGaps(profile);
    const next =
      missing.length === 0
        ? EmployeeProfileStatus.PENDING_REVIEW
        : EmployeeProfileStatus.INCOMPLETE;
    if (next === from) return;

    await this.prisma.employeeProfile.update({
      where: { id },
      data: { status: next as PrismaEmployeeProfileStatus },
    });
  }

  private async validateProfilePayload(
    dto: EmployeeBaseDto,
    existing?: {
      birthDate: Date | null;
      youthUnionAdmissionDate: Date | null;
    },
  ) {
    const birthDate = dto.birthDate
      ? this.toDate(dto.birthDate)
      : existing?.birthDate ?? undefined;
    const identityIssuedDate = dto.identityIssuedDate
      ? this.toDate(dto.identityIssuedDate)
      : undefined;
    const youthUnionAdmissionDate = dto.youthUnionAdmissionDate
      ? this.toDate(dto.youthUnionAdmissionDate)
      : existing?.youthUnionAdmissionDate ?? undefined;
    const partyAdmissionDate = dto.partyAdmissionDate
      ? this.toDate(dto.partyAdmissionDate)
      : undefined;

    if (identityIssuedDate && birthDate && identityIssuedDate < birthDate) {
      throw new BadRequestException('Ngày cấp phải lớn hơn hoặc bằng ngày sinh');
    }
    if (youthUnionAdmissionDate && birthDate && youthUnionAdmissionDate <= birthDate) {
      throw new BadRequestException('Ngày kết nạp Đoàn phải sau ngày sinh');
    }
    if (
      partyAdmissionDate &&
      youthUnionAdmissionDate &&
      partyAdmissionDate <= youthUnionAdmissionDate
    ) {
      throw new BadRequestException('Ngày kết nạp Đảng phải sau ngày kết nạp Đoàn');
    }
  }

  private toCreateScalarData(
    dto: CreateEmployeeDto,
    profileCode: string,
  ): Prisma.EmployeeProfileCreateInput {
    return {
      profileCode,
      fullName: this.normalizeName(dto.fullName),
      gender: dto.gender ?? null,
      birthDate: dto.birthDate ? this.toDate(dto.birthDate) : null,
      birthPlace: dto.birthPlace?.trim() || null,
      placeOfOrigin: dto.placeOfOrigin?.trim() || null,
      permanentAddress: dto.permanentAddress?.trim() || null,
      currentAddress: dto.currentAddress?.trim() || null,
      phone: this.normalizePhone(dto.phone),
      email: dto.email ? this.normalizeEmail(dto.email) : null,
      ethnicity: dto.ethnicity ?? null,
      religion: dto.religion ?? null,
      identityNumber: dto.identityNumber?.trim() || null,
      identityIssuedDate: dto.identityIssuedDate
        ? this.toDate(dto.identityIssuedDate)
        : null,
      identityIssuedPlace: dto.identityIssuedPlace?.trim() || null,
      educationLevel: dto.educationLevel ?? null,
      youthUnionAdmissionDate: dto.youthUnionAdmissionDate
        ? this.toDate(dto.youthUnionAdmissionDate)
        : null,
      youthUnionAdmissionPlace: this.optionalText(dto.youthUnionAdmissionPlace),
      partyAdmissionDate: dto.partyAdmissionDate
        ? this.toDate(dto.partyAdmissionDate)
        : null,
      partyAdmissionPlace: this.optionalText(dto.partyAdmissionPlace),
      rewardDiscipline: this.optionalText(dto.rewardDiscipline),
      strengths: this.optionalText(dto.strengths),
      employmentStatus: dto.employmentStatus ?? null,
      workPresenceStatus:
        dto.workPresenceStatus ?? EmployeeWorkPresenceStatus.UNKNOWN,
      managingCompany: { connect: { id: dto.managingCompanyId } },
      status: PrismaEmployeeProfileStatus.INCOMPLETE,
    };
  }

  private toUpdateScalarData(dto: UpdateEmployeeDto): Prisma.EmployeeProfileUpdateInput {
    return {
      ...(dto.fullName !== undefined ? { fullName: this.normalizeName(dto.fullName) } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.birthDate !== undefined
        ? { birthDate: dto.birthDate ? this.toDate(dto.birthDate) : null }
        : {}),
      ...(dto.birthPlace !== undefined
        ? { birthPlace: dto.birthPlace?.trim() || null }
        : {}),
      ...(dto.placeOfOrigin !== undefined
        ? { placeOfOrigin: dto.placeOfOrigin?.trim() || null }
        : {}),
      ...(dto.permanentAddress !== undefined
        ? { permanentAddress: dto.permanentAddress?.trim() || null }
        : {}),
      ...(dto.currentAddress !== undefined
        ? { currentAddress: dto.currentAddress?.trim() || null }
        : {}),
      ...(dto.phone !== undefined ? { phone: this.normalizePhone(dto.phone) } : {}),
      ...(dto.email !== undefined
        ? { email: dto.email ? this.normalizeEmail(dto.email) : null }
        : {}),
      ...(dto.ethnicity !== undefined ? { ethnicity: dto.ethnicity } : {}),
      ...(dto.religion !== undefined ? { religion: dto.religion } : {}),
      ...(dto.identityNumber !== undefined
        ? { identityNumber: dto.identityNumber?.trim() || null }
        : {}),
      ...(dto.identityIssuedDate !== undefined
        ? {
            identityIssuedDate: dto.identityIssuedDate
              ? this.toDate(dto.identityIssuedDate)
              : null,
          }
        : {}),
      ...(dto.identityIssuedPlace !== undefined
        ? { identityIssuedPlace: dto.identityIssuedPlace?.trim() || null }
        : {}),
      ...(dto.educationLevel !== undefined
        ? { educationLevel: dto.educationLevel }
        : {}),
      ...(dto.youthUnionAdmissionDate !== undefined
        ? {
            youthUnionAdmissionDate: dto.youthUnionAdmissionDate
              ? this.toDate(dto.youthUnionAdmissionDate)
              : null,
          }
        : {}),
      ...(dto.youthUnionAdmissionPlace !== undefined
        ? { youthUnionAdmissionPlace: this.optionalText(dto.youthUnionAdmissionPlace) }
        : {}),
      ...(dto.partyAdmissionDate !== undefined
        ? {
            partyAdmissionDate: dto.partyAdmissionDate
              ? this.toDate(dto.partyAdmissionDate)
              : null,
          }
        : {}),
      ...(dto.partyAdmissionPlace !== undefined
        ? { partyAdmissionPlace: this.optionalText(dto.partyAdmissionPlace) }
        : {}),
      ...(dto.rewardDiscipline !== undefined
        ? { rewardDiscipline: this.optionalText(dto.rewardDiscipline) }
        : {}),
      ...(dto.strengths !== undefined
        ? { strengths: this.optionalText(dto.strengths) }
        : {}),
      ...(dto.employmentStatus !== undefined
        ? { employmentStatus: dto.employmentStatus }
        : {}),
      ...(dto.workPresenceStatus !== undefined
        ? { workPresenceStatus: dto.workPresenceStatus }
        : {}),
      ...(dto.managingCompanyId !== undefined
        ? { managingCompanyId: dto.managingCompanyId }
        : {}),
    };
  }

  private normalizeName(value: string) {
    return value.trim().toLocaleUpperCase('vi-VN');
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private optionalText(value: string | null | undefined) {
    return value?.trim() ? value.trim() : null;
  }

  /** Công ty chủ quản phải tồn tại và đang ACTIVE. */
  private async ensureManagingCompanyAssignable(companyId: string) {
    if (!companyId) {
      throw new BadRequestException('Công ty chủ quản là bắt buộc');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true, name: true },
    });
    if (!company) {
      throw new BadRequestException('Công ty chủ quản không tồn tại');
    }
    if (company.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException(
        `Công ty chủ quản "${company.name}" không còn hoạt động`,
      );
    }
    return company;
  }

  private toDate(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toMonthDate(value: string) {
    return new Date(`${value}-01T00:00:00.000Z`);
  }

  private toMonthString(value: Date) {
    return value.toISOString().slice(0, 7);
  }

  private async nextFamilySortOrder(employeeProfileId: string) {
    const result = await this.prisma.employeeFamilyMember.aggregate({
      where: { employeeProfileId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async nextEducationSortOrder(employeeProfileId: string) {
    const result = await this.prisma.employeeEducationHistory.aggregate({
      where: { employeeProfileId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async nextWorkSortOrder(employeeProfileId: string) {
    const result = await this.prisma.employeeWorkHistory.aggregate({
      where: { employeeProfileId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async getFamilyMemberOrThrow(employeeProfileId: string, id: string) {
    const row = await this.prisma.employeeFamilyMember.findUnique({ where: { id } });
    if (!row || row.employeeProfileId !== employeeProfileId) {
      throw new NotFoundException('Employee record item not found');
    }
    return row;
  }

  private async getEducationHistoryOrThrow(
    employeeProfileId: string,
    id: string,
  ) {
    const row = await this.prisma.employeeEducationHistory.findUnique({ where: { id } });
    if (!row || row.employeeProfileId !== employeeProfileId) {
      throw new NotFoundException('Employee record item not found');
    }
    return row;
  }

  private async getWorkHistoryOrThrow(employeeProfileId: string, id: string) {
    const row = await this.prisma.employeeWorkHistory.findUnique({ where: { id } });
    if (!row || row.employeeProfileId !== employeeProfileId) {
      throw new NotFoundException('Employee record item not found');
    }
    return row;
  }

  private async reorderFamilyMembersInternal(
    employeeProfileId: string,
    orderedIds: string[],
  ) {
    const rows = await this.prisma.employeeFamilyMember.findMany({
      where: { employeeProfileId },
      select: { id: true },
    });
    this.assertReorderIds(rows.map((row) => row.id), orderedIds);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.employeeFamilyMember.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private async reorderEducationHistoriesInternal(
    employeeProfileId: string,
    orderedIds: string[],
  ) {
    const rows = await this.prisma.employeeEducationHistory.findMany({
      where: { employeeProfileId },
      select: { id: true },
    });
    this.assertReorderIds(rows.map((row) => row.id), orderedIds);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.employeeEducationHistory.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private async reorderWorkHistoriesInternal(
    employeeProfileId: string,
    orderedIds: string[],
  ) {
    const rows = await this.prisma.employeeWorkHistory.findMany({
      where: { employeeProfileId },
      select: { id: true },
    });
    this.assertReorderIds(rows.map((row) => row.id), orderedIds);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.employeeWorkHistory.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private assertReorderIds(existingIds: string[], orderedIds: string[]) {
    const left = [...existingIds].sort();
    const right = [...orderedIds].sort();
    if (left.length !== right.length || left.some((id, index) => id !== right[index])) {
      throw new BadRequestException('Danh sách sắp xếp không hợp lệ');
    }
  }

  private async ensureFamilyRelationshipUnique(
    employeeProfileId: string,
    relationship: string,
    excludeId?: string,
  ) {
    if (
      ![
        FamilyRelationship.FATHER,
        FamilyRelationship.MOTHER,
        FamilyRelationship.GUARDIAN,
      ].includes(relationship as FamilyRelationship)
    ) {
      return;
    }
    const existing = await this.prisma.employeeFamilyMember.findFirst({
      where: { employeeProfileId, relationship },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Quan hệ này chỉ được khai báo một lần');
    }
  }

  private async validateEducationHistory(
    employeeProfileId: string,
    dto: {
      fromMonth: string;
      toMonth: string;
      institution: string;
      major: string;
      trainingMode: string;
      degree: string;
    },
    excludeId?: string,
  ) {
    if (dto.fromMonth > dto.toMonth) {
      throw new BadRequestException('Từ tháng phải nhỏ hơn hoặc bằng Đến tháng');
    }
    const existing = await this.prisma.employeeEducationHistory.findFirst({
      where: {
        employeeProfileId,
        fromMonth: this.toMonthDate(dto.fromMonth),
        toMonth: this.toMonthDate(dto.toMonth),
        institution: dto.institution.trim(),
      },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Quá trình đào tạo bị trùng thời gian và cơ sở đào tạo');
    }
  }

  private async validateWorkHistory(
    employeeProfileId: string,
    dto: {
      fromMonth: string;
      toMonth?: string;
      company: string;
      department?: string;
      position: string;
    },
    excludeId?: string,
  ) {
    if (dto.toMonth && dto.fromMonth > dto.toMonth) {
      throw new BadRequestException('Từ tháng phải nhỏ hơn hoặc bằng Đến tháng');
    }
    const existing = await this.prisma.employeeWorkHistory.findFirst({
      where: {
        employeeProfileId,
        fromMonth: this.toMonthDate(dto.fromMonth),
        toMonth: dto.toMonth ? this.toMonthDate(dto.toMonth) : null,
        company: dto.company.trim(),
      },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Quá trình công tác bị trùng thời gian và công ty');
    }
  }
}
