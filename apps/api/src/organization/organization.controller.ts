import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { OrganizationService } from './organization.service';
import { CompaniesService } from './companies.service';
import { OrganizationUnitsService } from './organization-units.service';
import { OrganizationTreeService } from './organization-tree.service';
import {
  CreateCompanyDto,
  CreateOrganizationUnitDto,
  MoveOrganizationUnitDto,
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

  @Patch('units/:id/move')
  @RequirePermissions(Permissions.ORG_UNIT_MOVE)
  moveUnit(@Param('id') id: string, @Body() dto: MoveOrganizationUnitDto) {
    return this.unitsService.move(id, dto);
  }

  @Delete('units/:id')
  @RequirePermissions(Permissions.ORG_UNIT_DELETE)
  deleteUnit(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }
}
