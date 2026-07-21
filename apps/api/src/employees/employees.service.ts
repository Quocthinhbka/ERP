import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyRelationship } from '@erp/shared';
import { EntityStatus as PrismaEntityStatus, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
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
  UpdateFamilyMemberDto,
  UpdateWorkHistoryDto,
} from './dto/employee.dto';

const profileInclude = {
  linkedUser: {
    select: {
      id: true,
      accountCode: true,
      email: true,
      fullName: true,
    },
  },
  familyMembers: { orderBy: { sortOrder: 'asc' as const } },
  educationHistories: { orderBy: { sortOrder: 'asc' as const } },
  workHistories: { orderBy: { sortOrder: 'asc' as const } },
} as const;

type TxClient = Prisma.TransactionClient;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(query: EmployeeQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.EmployeeProfileWhereInput = {
      ...(query.status ? { status: query.status as PrismaEntityStatus } : {}),
      ...(search
        ? {
            OR: [
              { profileCode: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { identityNumber: { contains: search, mode: 'insensitive' } },
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
          status: true,
          createdAt: true,
          linkedUser: {
            select: { id: true, accountCode: true, email: true, fullName: true },
          },
        },
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: profileInclude,
    });
    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }
    return profile;
  }

  async create(dto: CreateEmployeeDto) {
    await this.validateProfilePayload(dto);
    if (dto.linkedUserId) {
      await this.ensureUserCanLink(dto.linkedUserId);
      await this.ensureLinkedUserFieldsAvailable(
        dto.linkedUserId,
        dto.phone,
        dto.email,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const profileCode = await this.allocateProfileCode(tx);
      const profile = await tx.employeeProfile.create({
        data: this.toCreateScalarData(dto, profileCode),
      });
      if (dto.linkedUserId) {
        await this.syncLinkedUser(tx, dto.linkedUserId, profile.id, profile);
      }
      return tx.employeeProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: profileInclude,
      });
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: { linkedUser: { select: { id: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Employee profile not found');
    }

    await this.validateProfilePayload(dto, existing);

    if (dto.linkedUserId) {
      await this.ensureUserCanLink(dto.linkedUserId, id);
    }
    const targetUserId =
      dto.linkedUserId !== undefined
        ? dto.linkedUserId || null
        : existing.linkedUser?.id ?? null;

    const nextPhone = dto.phone ?? existing.phone;
    const nextEmail = dto.email ?? existing.email;
    if (targetUserId) {
      await this.ensureLinkedUserFieldsAvailable(
        targetUserId,
        nextPhone,
        nextEmail,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employeeProfile.update({
        where: { id },
        data: this.toUpdateScalarData(dto),
      });

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

      return tx.employeeProfile.findUniqueOrThrow({
        where: { id },
        include: profileInclude,
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employeeProfile.update({
      where: { id },
      data: { status: PrismaEntityStatus.INACTIVE },
      include: profileInclude,
    });
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
    email: string,
  ) {
    await this.authService.ensurePhoneAvailable(this.normalizePhone(phone), userId);
    await this.authService.ensureEmailAvailable(this.normalizeEmail(email), userId);
  }

  private async syncLinkedUser(
    tx: TxClient,
    userId: string,
    profileId: string,
    profile: { fullName: string; phone: string; email: string },
  ) {
    await tx.user.update({
      where: { id: userId },
      data: {
        linkedEmployeeProfileId: profileId,
        fullName: profile.fullName,
        phone: this.normalizePhone(profile.phone),
        email: this.normalizeEmail(profile.email),
      },
    });
  }

  private async validateProfilePayload(
    dto: EmployeeBaseDto,
    existing?: {
      birthDate: Date;
      youthUnionAdmissionDate: Date | null;
    },
  ) {
    const birthDate = dto.birthDate ? this.toDate(dto.birthDate) : existing?.birthDate;
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
      gender: dto.gender,
      birthDate: this.toDate(dto.birthDate),
      birthPlace: dto.birthPlace.trim(),
      placeOfOrigin: dto.placeOfOrigin.trim(),
      permanentAddress: dto.permanentAddress.trim(),
      currentAddress: dto.currentAddress.trim(),
      phone: this.normalizePhone(dto.phone),
      email: this.normalizeEmail(dto.email),
      ethnicity: dto.ethnicity,
      religion: dto.religion ?? null,
      identityNumber: dto.identityNumber.trim(),
      identityIssuedDate: this.toDate(dto.identityIssuedDate),
      identityIssuedPlace: dto.identityIssuedPlace.trim(),
      educationLevel: dto.educationLevel,
      youthUnionAdmissionDate: dto.youthUnionAdmissionDate
        ? this.toDate(dto.youthUnionAdmissionDate)
        : null,
      youthUnionAdmissionPlace: this.optionalText(dto.youthUnionAdmissionPlace),
      partyAdmissionDate: dto.partyAdmissionDate ? this.toDate(dto.partyAdmissionDate) : null,
      partyAdmissionPlace: this.optionalText(dto.partyAdmissionPlace),
      rewardDiscipline: this.optionalText(dto.rewardDiscipline),
      strengths: this.optionalText(dto.strengths),
      status: dto.status ?? PrismaEntityStatus.ACTIVE,
    };
  }

  private toUpdateScalarData(dto: EmployeeBaseDto): Prisma.EmployeeProfileUpdateInput {
    return {
      ...(dto.fullName !== undefined ? { fullName: this.normalizeName(dto.fullName) } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.birthDate !== undefined ? { birthDate: this.toDate(dto.birthDate) } : {}),
      ...(dto.birthPlace !== undefined ? { birthPlace: dto.birthPlace.trim() } : {}),
      ...(dto.placeOfOrigin !== undefined ? { placeOfOrigin: dto.placeOfOrigin.trim() } : {}),
      ...(dto.permanentAddress !== undefined ? { permanentAddress: dto.permanentAddress.trim() } : {}),
      ...(dto.currentAddress !== undefined ? { currentAddress: dto.currentAddress.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: this.normalizePhone(dto.phone) } : {}),
      ...(dto.email !== undefined ? { email: this.normalizeEmail(dto.email) } : {}),
      ...(dto.ethnicity !== undefined ? { ethnicity: dto.ethnicity } : {}),
      ...(dto.religion !== undefined ? { religion: dto.religion } : {}),
      ...(dto.identityNumber !== undefined ? { identityNumber: dto.identityNumber.trim() } : {}),
      ...(dto.identityIssuedDate !== undefined
        ? { identityIssuedDate: this.toDate(dto.identityIssuedDate) }
        : {}),
      ...(dto.identityIssuedPlace !== undefined
        ? { identityIssuedPlace: dto.identityIssuedPlace.trim() }
        : {}),
      ...(dto.educationLevel !== undefined ? { educationLevel: dto.educationLevel } : {}),
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
      ...(dto.strengths !== undefined ? { strengths: this.optionalText(dto.strengths) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
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
