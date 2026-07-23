import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeProfileEditRequestStatus,
  EmployeeProfileStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import {
  CreateEducationHistoryDto,
  CreateFamilyMemberDto,
  CreateWorkHistoryDto,
  EmployeeCollectionQueryDto,
  ReorderChildrenDto,
  UpdateEducationHistoryDto,
  UpdateEmployeeDto,
  UpdateFamilyMemberDto,
  UpdateWorkHistoryDto,
  UploadEmployeeDocumentDto,
} from '../employees/dto/employee.dto';
import { CreateProfileEditRequestDto } from './dto/personal.dto';

const SELF_EDITABLE_STATUSES = new Set<EmployeeProfileStatus>([
  EmployeeProfileStatus.INCOMPLETE,
  EmployeeProfileStatus.NEEDS_ADJUSTMENT,
]);

@Injectable()
export class PersonalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  async getAccount(userId: string) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountCode: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        linkedEmployeeProfileId: true,
        isSuperAdmin: true,
      },
    });
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản');
    return account;
  }

  async getProfile(userId: string) {
    const profileId = await this.resolveProfileId(userId);
    const [profile, latestEditRequest] = await Promise.all([
      this.employees.findOne(profileId),
      this.prisma.employeeProfileEditRequest.findFirst({
        where: { employeeProfileId: profileId },
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, fullName: true, accountCode: true } },
          reviewedBy: { select: { id: true, fullName: true, accountCode: true } },
        },
      }),
    ]);
    return { ...profile, latestEditRequest };
  }

  async updateProfile(userId: string, dto: UpdateEmployeeDto) {
    const profileId = await this.resolveEditableProfileId(userId);
    if (dto.linkedUserId !== undefined) {
      throw new BadRequestException('Không được thay đổi tài khoản liên kết');
    }
    return this.employees.update(profileId, dto);
  }

  async completeProfile(userId: string) {
    const profileId = await this.resolveProfileId(userId);
    return this.employees.complete(profileId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    return this.employees.uploadAvatar(
      await this.resolveEditableProfileId(userId),
      file,
    );
  }

  async removeAvatar(userId: string) {
    return this.employees.removeAvatar(await this.resolveEditableProfileId(userId));
  }

  async listDocuments(userId: string) {
    return this.employees.listDocuments(await this.resolveProfileId(userId));
  }

  async uploadDocument(
    userId: string,
    dto: UploadEmployeeDocumentDto,
    file: Express.Multer.File,
  ) {
    return this.employees.uploadDocument(
      await this.resolveEditableProfileId(userId),
      dto,
      file,
    );
  }

  async deleteDocument(userId: string, documentId: string) {
    return this.employees.deleteDocument(
      await this.resolveEditableProfileId(userId),
      documentId,
    );
  }

  async listFamilyMembers(userId: string, query: EmployeeCollectionQueryDto) {
    return this.employees.listFamilyMembers(await this.resolveProfileId(userId), query);
  }

  async createFamilyMember(userId: string, dto: CreateFamilyMemberDto) {
    return this.employees.createFamilyMember(
      await this.resolveEditableProfileId(userId),
      dto,
    );
  }

  async updateFamilyMember(
    userId: string,
    memberId: string,
    dto: UpdateFamilyMemberDto,
  ) {
    return this.employees.updateFamilyMember(
      await this.resolveEditableProfileId(userId),
      memberId,
      dto,
    );
  }

  async deleteFamilyMember(userId: string, memberId: string) {
    return this.employees.deleteFamilyMember(
      await this.resolveEditableProfileId(userId),
      memberId,
    );
  }

  async reorderFamilyMembers(userId: string, dto: ReorderChildrenDto) {
    return this.employees.reorderFamilyMembers(
      await this.resolveEditableProfileId(userId),
      dto,
    );
  }

  async listEducationHistories(userId: string, query: EmployeeCollectionQueryDto) {
    return this.employees.listEducationHistories(
      await this.resolveProfileId(userId),
      query,
    );
  }

  async createEducationHistory(userId: string, dto: CreateEducationHistoryDto) {
    return this.employees.createEducationHistory(
      await this.resolveEditableProfileId(userId),
      dto,
    );
  }

  async updateEducationHistory(
    userId: string,
    historyId: string,
    dto: UpdateEducationHistoryDto,
  ) {
    return this.employees.updateEducationHistory(
      await this.resolveEditableProfileId(userId),
      historyId,
      dto,
    );
  }

  async deleteEducationHistory(userId: string, historyId: string) {
    return this.employees.deleteEducationHistory(
      await this.resolveEditableProfileId(userId),
      historyId,
    );
  }

  async reorderEducationHistories(userId: string, dto: ReorderChildrenDto) {
    return this.employees.reorderEducationHistories(
      await this.resolveEditableProfileId(userId),
      dto,
    );
  }

  async listWorkHistories(userId: string, query: EmployeeCollectionQueryDto) {
    return this.employees.listWorkHistories(
      await this.resolveProfileId(userId),
      query,
    );
  }

  async createWorkHistory(userId: string, dto: CreateWorkHistoryDto) {
    return this.employees.createWorkHistory(
      await this.resolveEditableProfileId(userId),
      dto,
    );
  }

  async updateWorkHistory(
    userId: string,
    historyId: string,
    dto: UpdateWorkHistoryDto,
  ) {
    return this.employees.updateWorkHistory(
      await this.resolveEditableProfileId(userId),
      historyId,
      dto,
    );
  }

  async deleteWorkHistory(userId: string, historyId: string) {
    return this.employees.deleteWorkHistory(
      await this.resolveEditableProfileId(userId),
      historyId,
    );
  }

  async reorderWorkHistories(userId: string, dto: ReorderChildrenDto) {
    return this.employees.reorderWorkHistories(
      await this.resolveEditableProfileId(userId),
      dto,
    );
  }

  async createEditRequest(userId: string, dto: CreateProfileEditRequestDto) {
    const profileId = await this.resolveProfileId(userId);
    const profile = await this.prisma.employeeProfile.findUniqueOrThrow({
      where: { id: profileId },
      select: { status: true },
    });
    if (SELF_EDITABLE_STATUSES.has(profile.status)) {
      throw new BadRequestException('Hồ sơ hiện đang được phép chỉnh sửa trực tiếp');
    }
    if (profile.status !== EmployeeProfileStatus.VERIFIED) {
      throw new BadRequestException(
        'Chỉ hồ sơ Đã xác nhận mới gửi được yêu cầu chỉnh sửa',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.employeeProfileEditRequest.create({
          data: {
            employeeProfileId: profileId,
            requestedByUserId: userId,
            reason: dto.reason.trim(),
          },
        });
        await tx.employeeProfile.update({
          where: { id: profileId },
          data: { status: EmployeeProfileStatus.EDIT_REQUESTED },
        });
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Hồ sơ đã có yêu cầu chỉnh sửa đang chờ xử lý');
      }
      throw error;
    }
  }

  async cancelEditRequest(userId: string, requestId: string) {
    const existing = await this.prisma.employeeProfileEditRequest.findFirst({
      where: {
        id: requestId,
        requestedByUserId: userId,
        status: EmployeeProfileEditRequestStatus.PENDING,
      },
      select: { id: true, employeeProfileId: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy yêu cầu đang chờ xử lý');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeProfileEditRequest.update({
        where: { id: existing.id },
        data: { status: EmployeeProfileEditRequestStatus.CANCELLED },
      });
      await tx.employeeProfile.update({
        where: { id: existing.employeeProfileId },
        data: { status: EmployeeProfileStatus.VERIFIED },
      });
    });

    return this.prisma.employeeProfileEditRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
  }

  private async resolveProfileId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { linkedEmployeeProfileId: true },
    });
    if (!user?.linkedEmployeeProfileId) {
      throw new NotFoundException('Tài khoản chưa liên kết hồ sơ nhân sự');
    }
    return user.linkedEmployeeProfileId;
  }

  private async resolveEditableProfileId(userId: string) {
    const profileId = await this.resolveProfileId(userId);
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id: profileId },
      select: { status: true },
    });
    if (!profile || !SELF_EDITABLE_STATUSES.has(profile.status)) {
      throw new BadRequestException(
        'Trạng thái hồ sơ hiện tại không cho phép chỉnh sửa trực tiếp',
      );
    }
    return profileId;
  }
}
