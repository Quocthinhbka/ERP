import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { OrgNodeType, Permissions, orgScopeKey } from '@erp/shared';
import { OrganizationService } from './organization.service';
import { CompaniesService } from './companies.service';
import { OrganizationUnitsService } from './organization-units.service';
import { OrganizationTreeService } from './organization-tree.service';
import { OrganizationIoService } from './organization-io.service';
import { PositionPermissionsService } from './position-permissions.service';
import {
  ApplyOrganizationImportDto,
  CreateCompanyDto,
  CreateOrganizationUnitDto,
  ExportOrganizationDto,
  ReorderNodeDto,
  UpdateCompanyDto,
  UpdateOrganizationDto,
  UpdateOrganizationUnitDto,
} from './dto/organization.dto';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../common/guards/auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('organization')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private companiesService: CompaniesService,
    private unitsService: OrganizationUnitsService,
    private treeService: OrganizationTreeService,
    private organizationIoService: OrganizationIoService,
    private positionPermissions: PositionPermissionsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  async getOrganization(@CurrentUser() user: RequestUser) {
    const org = await this.organizationService.getCurrent();
    this.positionPermissions.assertCanAccessNode(
      user.isSystemAdmin,
      user.orgScopes,
      OrgNodeType.ORGANIZATION,
      org.id,
      [],
    );
    return org;
  }

  @Patch()
  @RequirePermissions(Permissions.ORGANIZATION_MANAGE)
  async updateOrganization(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const org = await this.organizationService.getCurrent();
    this.positionPermissions.assertCanAccessNode(
      user.isSystemAdmin,
      user.orgScopes,
      OrgNodeType.ORGANIZATION,
      org.id,
      [],
    );
    return this.organizationService.update(dto);
  }

  @Get('tree')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  getTree(@CurrentUser() user: RequestUser, @Query('search') search?: string) {
    return this.treeService.getTree(search, {
      isSystemAdmin: user.isSystemAdmin,
      orgScopes: user.orgScopes,
    });
  }

  @Post('export')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  exportOrganization(
    @CurrentUser() user: RequestUser,
    @Body() dto: ExportOrganizationDto,
  ) {
    this.requireFullOrgAccess(user);
    return this.organizationIoService.enqueueExport(dto.format ?? 'excel');
  }

  @Post('import/diff')
  @RequirePermissions(Permissions.ORGANIZATION_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024 },
    }),
  )
  importDiff(@CurrentUser() user: RequestUser, @UploadedFile() file: Express.Multer.File) {
    this.requireFullOrgAccess(user);
    return this.organizationIoService.enqueueDiff(file);
  }

  @Post('import/apply')
  @RequirePermissions(Permissions.ORGANIZATION_MANAGE)
  importApply(@CurrentUser() user: RequestUser, @Body() dto: ApplyOrganizationImportDto) {
    this.requireFullOrgAccess(user);
    return this.organizationIoService.enqueueApply(dto.snapshotJobId, dto.selections);
  }

  @Get('io/jobs/:jobId')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  getIoJob(@Param('jobId') jobId: string) {
    return this.organizationIoService.getJob(jobId);
  }

  @Get('io/jobs/:jobId/download')
  @RequirePermissions(Permissions.ORGANIZATION_VIEW)
  async downloadExport(@Param('jobId') jobId: string, @Res({ passthrough: true }) res: Response) {
    const { file, fileName, contentType } =
      await this.organizationIoService.downloadExport(jobId);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return file;
  }

  @Get('companies')
  @RequirePermissions(
    Permissions.COMPANY_VIEW,
    Permissions.ORGANIZATION_VIEW,
    Permissions.HR_EMPLOYEE_CREATE,
    Permissions.HR_EMPLOYEE_VIEW,
  )
  listCompanies() {
    return this.companiesService.list();
  }

  @Post('companies')
  @RequirePermissions(Permissions.COMPANY_CREATE)
  async createCompany(@CurrentUser() user: RequestUser, @Body() dto: CreateCompanyDto) {
    const org = await this.prisma.organization.findFirst();
    if (org) {
      this.positionPermissions.assertCanAccessNode(
        user.isSystemAdmin,
        user.orgScopes,
        OrgNodeType.ORGANIZATION,
        org.id,
        [],
      );
    }
    return this.companiesService.create(dto);
  }

  @Patch('companies/:id')
  @RequirePermissions(Permissions.COMPANY_UPDATE)
  async updateCompany(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    await this.assertCompanyAccess(user, id);
    return this.companiesService.update(id, dto);
  }

  @Patch('companies/:id/reorder')
  @RequirePermissions(Permissions.ORG_UNIT_MOVE)
  async reorderCompany(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReorderNodeDto,
  ) {
    await this.assertCompanyAccess(user, id);
    return this.companiesService.reorder(id, dto.direction);
  }

  @Delete('companies/:id')
  @RequirePermissions(Permissions.COMPANY_DELETE)
  async deleteCompany(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.assertCompanyAccess(user, id);
    return this.companiesService.remove(id);
  }

  @Post('units')
  @RequirePermissions(Permissions.ORG_UNIT_CREATE)
  async createUnit(@CurrentUser() user: RequestUser, @Body() dto: CreateOrganizationUnitDto) {
    if (dto.parentUnitId) {
      await this.assertUnitAccess(user, dto.parentUnitId);
    } else {
      await this.assertCompanyAccess(user, dto.companyId);
    }
    return this.unitsService.create(dto);
  }

  @Patch('units/:id')
  @RequirePermissions(Permissions.ORG_UNIT_UPDATE)
  async updateUnit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationUnitDto,
  ) {
    await this.assertUnitAccess(user, id);
    return this.unitsService.update(id, dto);
  }

  @Patch('units/:id/reorder')
  @RequirePermissions(Permissions.ORG_UNIT_MOVE)
  async reorderUnit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReorderNodeDto,
  ) {
    await this.assertUnitAccess(user, id);
    return this.unitsService.reorder(id, dto.direction);
  }

  @Delete('units/:id')
  @RequirePermissions(Permissions.ORG_UNIT_DELETE)
  async deleteUnit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.assertUnitAccess(user, id);
    return this.unitsService.remove(id);
  }

  private requireFullOrgAccess(user: RequestUser) {
    if (user.isSystemAdmin) {
      return;
    }
    throw new ForbiddenException('Import/Export requires system administrator');
  }

  private async assertCompanyAccess(user: RequestUser, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return;
    }
    this.positionPermissions.assertCanAccessNode(
      user.isSystemAdmin,
      user.orgScopes,
      OrgNodeType.COMPANY,
      company.id,
      [orgScopeKey(OrgNodeType.ORGANIZATION, company.organizationId)],
    );
  }

  private async assertUnitAccess(user: RequestUser, unitId: string) {
    const unit = await this.prisma.organizationUnit.findUnique({
      where: { id: unitId },
      include: { company: true },
    });
    if (!unit) {
      return;
    }
    const ancestors = [
      orgScopeKey(OrgNodeType.COMPANY, unit.companyId),
      orgScopeKey(OrgNodeType.ORGANIZATION, unit.company.organizationId),
    ];
    let parentId = unit.parentUnitId;
    const parentKeys: string[] = [];
    while (parentId) {
      parentKeys.push(orgScopeKey(OrgNodeType.UNIT, parentId));
      const parent = await this.prisma.organizationUnit.findUnique({
        where: { id: parentId },
        select: { parentUnitId: true },
      });
      parentId = parent?.parentUnitId ?? null;
    }
    this.positionPermissions.assertCanAccessNode(
      user.isSystemAdmin,
      user.orgScopes,
      OrgNodeType.UNIT,
      unit.id,
      [...parentKeys, ...ancestors],
    );
  }
}
