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
import { Permissions } from '@erp/shared';
import { OrganizationService } from './organization.service';
import { CompaniesService } from './companies.service';
import { OrganizationUnitsService } from './organization-units.service';
import { OrganizationTreeService } from './organization-tree.service';
import { OrganizationIoService } from './organization-io.service';
import {
  ApplyOrganizationImportDto,
  CreateCompanyDto,
  CreateOrganizationUnitDto,
  ReorderNodeDto,
  UpdateCompanyDto,
  UpdateOrganizationDto,
  UpdateOrganizationUnitDto,
} from './dto/organization.dto';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../common/guards/auth.guard';

@Controller('organization')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private companiesService: CompaniesService,
    private unitsService: OrganizationUnitsService,
    private treeService: OrganizationTreeService,
    private organizationIoService: OrganizationIoService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  getOrganization() {
    return this.organizationService.getCurrent();
  }

  @Patch()
  @RequirePermissions(Permissions.ORGANIZATION_MANAGE)
  updateOrganization(@Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(dto);
  }

  @Get('tree')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  getTree(@Query('search') search?: string) {
    return this.treeService.getTree(search);
  }

  @Post('export')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  exportOrganization() {
    return this.organizationIoService.enqueueExport();
  }

  @Post('import/diff')
  @RequirePermissions(Permissions.ORGANIZATION_MANAGE)
  @UseInterceptors(FileInterceptor('file'))
  importDiff(@UploadedFile() file: Express.Multer.File) {
    return this.organizationIoService.enqueueDiff(file);
  }

  @Post('import/apply')
  @RequirePermissions(Permissions.ORGANIZATION_MANAGE)
  importApply(@Body() dto: ApplyOrganizationImportDto) {
    return this.organizationIoService.enqueueApply(dto.snapshotPath, dto.selections);
  }

  @Get('io/jobs/:jobId')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  getIoJob(@Param('jobId') jobId: string) {
    return this.organizationIoService.getJob(jobId);
  }

  @Get('io/jobs/:jobId/download')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  async downloadExport(@Param('jobId') jobId: string, @Res({ passthrough: true }) res: Response) {
    const { file, fileName } = await this.organizationIoService.downloadExport(jobId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return file;
  }

  @Post('companies')
  @RequirePermissions(Permissions.COMPANY_CREATE)
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch('companies/:id')
  @RequirePermissions(Permissions.COMPANY_UPDATE)
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Patch('companies/:id/reorder')
  @RequirePermissions(Permissions.ORG_UNIT_MOVE)
  reorderCompany(@Param('id') id: string, @Body() dto: ReorderNodeDto) {
    return this.companiesService.reorder(id, dto.direction);
  }

  @Delete('companies/:id')
  @RequirePermissions(Permissions.COMPANY_DELETE)
  deleteCompany(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  @Post('units')
  @RequirePermissions(Permissions.ORG_UNIT_CREATE)
  createUnit(@Body() dto: CreateOrganizationUnitDto) {
    return this.unitsService.create(dto);
  }

  @Patch('units/:id')
  @RequirePermissions(Permissions.ORG_UNIT_UPDATE)
  updateUnit(@Param('id') id: string, @Body() dto: UpdateOrganizationUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Patch('units/:id/reorder')
  @RequirePermissions(Permissions.ORG_UNIT_MOVE)
  reorderUnit(@Param('id') id: string, @Body() dto: ReorderNodeDto) {
    return this.unitsService.reorder(id, dto.direction);
  }

  @Delete('units/:id')
  @RequirePermissions(Permissions.ORG_UNIT_DELETE)
  deleteUnit(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }
}
