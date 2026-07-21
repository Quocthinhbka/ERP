import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../common/guards/auth.guard';
import { PermissionGroupsService } from './permission-groups.service';
import { CreatePermissionGroupDto, UpdatePermissionGroupDto } from './dto/permission-group.dto';

@Controller('permission-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionGroupsController {
  constructor(private readonly service: PermissionGroupsService) {}

  @Get()
  @RequirePermissions(Permissions.PERMISSION_GROUP_VIEW)
  findAll() {
    return this.service.findAll();
  }

  @Get('versions/:versionId/permissions')
  @RequirePermissions(Permissions.PERMISSION_GROUP_VIEW)
  getVersionPermissions(@Param('versionId') versionId: string) {
    return this.service.getVersionPermissions(versionId);
  }

  @Get('versions/:versionId/accounts')
  @RequirePermissions(Permissions.PERMISSION_GROUP_VIEW)
  getVersionAccounts(@Param('versionId') versionId: string) {
    return this.service.getVersionAccounts(versionId);
  }

  @Get(':id')
  @RequirePermissions(Permissions.PERMISSION_GROUP_VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permissions.PERMISSION_GROUP_CREATE)
  create(@Body() dto: CreatePermissionGroupDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.PERMISSION_GROUP_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdatePermissionGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.PERMISSION_GROUP_DELETE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
