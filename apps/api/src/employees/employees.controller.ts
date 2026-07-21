import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '@erp/shared';
import {
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../common/guards/auth.guard';
import {
  CreateEmployeeDto,
  CreateEducationHistoryDto,
  CreateFamilyMemberDto,
  CreateWorkHistoryDto,
  EmployeeCollectionQueryDto,
  EmployeeQueryDto,
  ReorderChildrenDto,
  UpdateEducationHistoryDto,
  UpdateEmployeeDto,
  UpdateFamilyMemberDto,
  UpdateWorkHistoryDto,
} from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(Permissions.HR_EMPLOYEE_VIEW)
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employees.findAll(query);
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

  @Delete(':id')
  @RequirePermissions(Permissions.HR_EMPLOYEE_DELETE)
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }
}
