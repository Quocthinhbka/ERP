import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/auth.guard';
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
import { PersonalService } from './personal.service';

@Controller('personal')
@UseGuards(JwtAuthGuard)
export class PersonalController {
  constructor(private readonly personal: PersonalService) {}

  @Get('account')
  getAccount(@CurrentUser() user: RequestUser) {
    return this.personal.getAccount(user.id);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: RequestUser) {
    return this.personal.getProfile(user.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateEmployeeDto) {
    return this.personal.updateProfile(user.id, dto);
  }

  @Post('profile/complete')
  completeProfile(@CurrentUser() user: RequestUser) {
    return this.personal.completeProfile(user.id);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadAvatar(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.personal.uploadAvatar(user.id, file);
  }

  @Delete('profile/avatar')
  removeAvatar(@CurrentUser() user: RequestUser) {
    return this.personal.removeAvatar(user.id);
  }

  @Get('profile/documents')
  listDocuments(@CurrentUser() user: RequestUser) {
    return this.personal.listDocuments(user.id);
  }

  @Post('profile/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadDocument(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.personal.uploadDocument(user.id, dto, file);
  }

  @Delete('profile/documents/:documentId')
  deleteDocument(
    @CurrentUser() user: RequestUser,
    @Param('documentId') documentId: string,
  ) {
    return this.personal.deleteDocument(user.id, documentId);
  }

  @Post('profile/edit-requests')
  createEditRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateProfileEditRequestDto,
  ) {
    return this.personal.createEditRequest(user.id, dto);
  }

  @Post('profile/edit-requests/:requestId/cancel')
  cancelEditRequest(
    @CurrentUser() user: RequestUser,
    @Param('requestId') requestId: string,
  ) {
    return this.personal.cancelEditRequest(user.id, requestId);
  }

  @Get('profile/family-members')
  listFamilyMembers(
    @CurrentUser() user: RequestUser,
    @Query() query: EmployeeCollectionQueryDto,
  ) {
    return this.personal.listFamilyMembers(user.id, query);
  }

  @Post('profile/family-members')
  createFamilyMember(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFamilyMemberDto,
  ) {
    return this.personal.createFamilyMember(user.id, dto);
  }

  @Patch('profile/family-members/reorder')
  reorderFamilyMembers(
    @CurrentUser() user: RequestUser,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.personal.reorderFamilyMembers(user.id, dto);
  }

  @Patch('profile/family-members/:memberId')
  updateFamilyMember(
    @CurrentUser() user: RequestUser,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.personal.updateFamilyMember(user.id, memberId, dto);
  }

  @Delete('profile/family-members/:memberId')
  deleteFamilyMember(
    @CurrentUser() user: RequestUser,
    @Param('memberId') memberId: string,
  ) {
    return this.personal.deleteFamilyMember(user.id, memberId);
  }

  @Get('profile/education-histories')
  listEducationHistories(
    @CurrentUser() user: RequestUser,
    @Query() query: EmployeeCollectionQueryDto,
  ) {
    return this.personal.listEducationHistories(user.id, query);
  }

  @Post('profile/education-histories')
  createEducationHistory(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateEducationHistoryDto,
  ) {
    return this.personal.createEducationHistory(user.id, dto);
  }

  @Patch('profile/education-histories/reorder')
  reorderEducationHistories(
    @CurrentUser() user: RequestUser,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.personal.reorderEducationHistories(user.id, dto);
  }

  @Patch('profile/education-histories/:historyId')
  updateEducationHistory(
    @CurrentUser() user: RequestUser,
    @Param('historyId') historyId: string,
    @Body() dto: UpdateEducationHistoryDto,
  ) {
    return this.personal.updateEducationHistory(user.id, historyId, dto);
  }

  @Delete('profile/education-histories/:historyId')
  deleteEducationHistory(
    @CurrentUser() user: RequestUser,
    @Param('historyId') historyId: string,
  ) {
    return this.personal.deleteEducationHistory(user.id, historyId);
  }

  @Get('profile/work-histories')
  listWorkHistories(
    @CurrentUser() user: RequestUser,
    @Query() query: EmployeeCollectionQueryDto,
  ) {
    return this.personal.listWorkHistories(user.id, query);
  }

  @Post('profile/work-histories')
  createWorkHistory(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWorkHistoryDto,
  ) {
    return this.personal.createWorkHistory(user.id, dto);
  }

  @Patch('profile/work-histories/reorder')
  reorderWorkHistories(
    @CurrentUser() user: RequestUser,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.personal.reorderWorkHistories(user.id, dto);
  }

  @Patch('profile/work-histories/:historyId')
  updateWorkHistory(
    @CurrentUser() user: RequestUser,
    @Param('historyId') historyId: string,
    @Body() dto: UpdateWorkHistoryDto,
  ) {
    return this.personal.updateWorkHistory(user.id, historyId, dto);
  }

  @Delete('profile/work-histories/:historyId')
  deleteWorkHistory(
    @CurrentUser() user: RequestUser,
    @Param('historyId') historyId: string,
  ) {
    return this.personal.deleteWorkHistory(user.id, historyId);
  }
}
