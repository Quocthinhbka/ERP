import { Module } from '@nestjs/common';
import { PermissionGroupsController } from './permission-groups.controller';
import { PermissionGroupsService } from './permission-groups.service';
import { PositionPermissionsModule } from '../organization/position-permissions.module';

@Module({
  imports: [PositionPermissionsModule],
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService],
  exports: [PermissionGroupsService],
})
export class PermissionGroupsModule {}
