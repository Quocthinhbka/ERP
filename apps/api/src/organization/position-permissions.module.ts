import { Module } from '@nestjs/common';
import { PositionPermissionsService } from './position-permissions.service';

@Module({
  providers: [PositionPermissionsService],
  exports: [PositionPermissionsService],
})
export class PositionPermissionsModule {}
