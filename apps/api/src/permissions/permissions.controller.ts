import { Controller, Get, UseGuards } from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../common/guards/auth.guard';

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions(Permissions.PERMISSION_VIEW)
  findAll() {
    return this.permissionsService.findAll();
  }
}
