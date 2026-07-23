import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EmployeeProfileEditRequestStatus, Permissions } from '@erp/shared';
import {
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../common/guards/auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import {
  ApplyEmployeeImportDto,
  CheckOrCreateEmployeeDto,
  CreateEmployeeDto,
  CreateEducationHistoryDto,
  CreateFamilyMemberDto,
  CreateWorkHistoryDto,
  EmployeeCollectionQueryDto,
  EmployeeQueryDto,
  ExportEmployeeDto,
  ReorderChildrenDto,
  UpdateEducationHistoryDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
  UpdateFamilyMemberDto,
  UpdateWorkHistoryDto,
  UploadEmployeeDocumentDto,
} from './dto/employee.dto';
import { EmployeesService } from './employees.service';
import { EmployeeIoService } from './employee-io.service';
import { ReviewProfileEditRequestDto } from '../personal/dto/personal.dto';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly employeeIo: EmployeeIoService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employees.findAll(query);
  }

  @Post('io/export')
  @RequirePermissions(Permissions.HR_EMPLOYEE_EXPORT)
  exportEmployees(
    @CurrentUser() user: RequestUser,
    @Body() dto: ExportEmployeeDto,
    @Query('template') template?: string,
  ) {
    return this.employeeIo.enqueueExport(user.id, {
      template: template === '1' || template === 'true',
      format: dto.format ?? 'excel',
    });
  }

  @Post('check-or-create')
  @RequirePermissions(Permissions.HR_EMPLOYEE_CREATE)
  checkOrCreate(@Body() dto: CheckOrCreateEmployeeDto) {
    return this.employees.checkOrCreate(dto);
  }

  @Post('io/import/diff')
  @RequirePermissions(Permissions.HR_EMPLOYEE_IMPORT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024,
      },
    }),
  )
  importDiff(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employeeIo.enqueueDiff(user.id, file);
  }

  @Post('io/import/apply')
  @RequirePermissions(Permissions.HR_EMPLOYEE_IMPORT)
  importApply(
    @CurrentUser() user: RequestUser,
    @Body() dto: ApplyEmployeeImportDto,
  ) {
    return this.employeeIo.enqueueApply(user.id, dto.snapshotJobId, dto.selections);
  }

  @Get('io/jobs/:jobId')
  @RequirePermissions(
    Permissions.HR_EMPLOYEE_VIEW,
    Permissions.HR_EMPLOYEE_EXPORT,
    Permissions.HR_EMPLOYEE_IMPORT,
  )
  getIoJob(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    return this.employeeIo.getJob(jobId, user.id);
  }

  @Get('io/jobs/:jobId/download')
  @RequirePermissions(Permissions.HR_EMPLOYEE_EXPORT)
  async downloadIoJob(
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, fileName, contentType } = await this.employeeIo.downloadExport(
      jobId,
      user.id,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return file;
  }

  @Get('edit-requests')
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  listEditRequests(@Query('status') status?: EmployeeProfileEditRequestStatus) {
    return this.employees.listEditRequests(status);
  }

  @Post('edit-requests/:requestId/approve')
  @RequirePermissions(Permissions.HR_EMPLOYEE_EDIT_REQUEST_REVIEW)
  approveEditRequest(
    @CurrentUser() user: RequestUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewProfileEditRequestDto,
  ) {
    return this.employees.approveEditRequest(requestId, user.id, dto.reviewNote);
  }

  @Post('edit-requests/:requestId/reject')
  @RequirePermissions(Permissions.HR_EMPLOYEE_EDIT_REQUEST_REVIEW)
  rejectEditRequest(
    @CurrentUser() user: RequestUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewProfileEditRequestDto,
  ) {
    return this.employees.rejectEditRequest(requestId, user.id, dto.reviewNote);
  }

  @Get(':id')
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  findOne(@Param('id') id: string) {
    return this.employees.findOne(id);
  }

  @Post()
  @RequirePermissions(Permissions.HR_EMPLOYEE_CREATE)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  complete(@Param('id') id: string) {
    return this.employees.complete(id);
  }

  @Patch(':id/status')
  @RequirePermissions(
    Permissions.HR_EMPLOYEE_STATUS_UPDATE,
    Permissions.HR_EMPLOYEE_VERIFY,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeStatusDto,
  ) {
    return this.employees.updateStatus(id, dto);
  }

  @Post(':id/avatar')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employees.uploadAvatar(id, file);
  }

  @Delete(':id/avatar')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  removeAvatar(@Param('id') id: string) {
    return this.employees.removeAvatar(id);
  }

  @Get(':id/documents')
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  listDocuments(@Param('id') id: string) {
    return this.employees.listDocuments(id);
  }

  @Post(':id/documents')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadDocument(
    @Param('id') id: string,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employees.uploadDocument(id, dto, file);
  }

  @Delete(':id/documents/:documentId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  deleteDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.employees.deleteDocument(id, documentId);
  }

  @Get(':id/family-members')
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  listFamilyMembers(
    @Param('id') id: string,
    @Query() query: EmployeeCollectionQueryDto,
  ) {
    return this.employees.listFamilyMembers(id, query);
  }

  @Post(':id/family-members')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  createFamilyMember(@Param('id') id: string, @Body() dto: CreateFamilyMemberDto) {
    return this.employees.createFamilyMember(id, dto);
  }

  @Patch(':id/family-members/reorder')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  reorderFamilyMembers(
    @Param('id') id: string,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.employees.reorderFamilyMembers(id, dto);
  }

  @Patch(':id/family-members/:memberId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  updateFamilyMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.employees.updateFamilyMember(id, memberId, dto);
  }

  @Delete(':id/family-members/:memberId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  deleteFamilyMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.employees.deleteFamilyMember(id, memberId);
  }

  @Get(':id/education-histories')
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  listEducationHistories(
    @Param('id') id: string,
    @Query() query: EmployeeCollectionQueryDto,
  ) {
    return this.employees.listEducationHistories(id, query);
  }

  @Post(':id/education-histories')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  createEducationHistory(
    @Param('id') id: string,
    @Body() dto: CreateEducationHistoryDto,
  ) {
    return this.employees.createEducationHistory(id, dto);
  }

  @Patch(':id/education-histories/reorder')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  reorderEducationHistories(
    @Param('id') id: string,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.employees.reorderEducationHistories(id, dto);
  }

  @Patch(':id/education-histories/:historyId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  updateEducationHistory(
    @Param('id') id: string,
    @Param('historyId') historyId: string,
    @Body() dto: UpdateEducationHistoryDto,
  ) {
    return this.employees.updateEducationHistory(id, historyId, dto);
  }

  @Delete(':id/education-histories/:historyId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  deleteEducationHistory(@Param('id') id: string, @Param('historyId') historyId: string) {
    return this.employees.deleteEducationHistory(id, historyId);
  }

  @Get(':id/work-histories')
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  listWorkHistories(
    @Param('id') id: string,
    @Query() query: EmployeeCollectionQueryDto,
  ) {
    return this.employees.listWorkHistories(id, query);
  }

  @Post(':id/work-histories')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  createWorkHistory(@Param('id') id: string, @Body() dto: CreateWorkHistoryDto) {
    return this.employees.createWorkHistory(id, dto);
  }

  @Patch(':id/work-histories/reorder')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  reorderWorkHistories(
    @Param('id') id: string,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.employees.reorderWorkHistories(id, dto);
  }

  @Patch(':id/work-histories/:historyId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  updateWorkHistory(
    @Param('id') id: string,
    @Param('historyId') historyId: string,
    @Body() dto: UpdateWorkHistoryDto,
  ) {
    return this.employees.updateWorkHistory(id, historyId, dto);
  }

  @Delete(':id/work-histories/:historyId')
  @RequirePermissions(Permissions.HR_EMPLOYEE_UPDATE)
  deleteWorkHistory(@Param('id') id: string, @Param('historyId') historyId: string) {
    return this.employees.deleteWorkHistory(id, historyId);
  }

  @Delete(':id/hard')
  @RequirePermissions(Permissions.HR_EMPLOYEE_DELETE)
  hardDelete(@Param('id') id: string) {
    return this.employees.hardDelete(id);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.HR_EMPLOYEE_DELETE)
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }
}
