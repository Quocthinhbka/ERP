import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Permissions } from '@erp/shared';
import { QueueService } from './queue.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../common/guards/auth.guard';

class EnqueueDemoDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}

@Controller('queue')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Post('demo')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  enqueueDemo(@Body() dto: EnqueueDemoDto) {
    return this.queueService.enqueueDemoJob(dto.message);
  }
}
