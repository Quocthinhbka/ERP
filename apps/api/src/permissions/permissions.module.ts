import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionsSyncService } from './permissions-sync.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsSyncService],
  exports: [PermissionsSyncService],
})
export class PermissionsModule {}
