import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { CompaniesService } from './companies.service';
import { OrganizationUnitsService } from './organization-units.service';
import { OrganizationTreeService } from './organization-tree.service';
import { OrganizationIoService } from './organization-io.service';

@Module({
  imports: [QueueModule],
  controllers: [OrganizationController],
  providers: [
    OrganizationService,
    CompaniesService,
    OrganizationUnitsService,
    OrganizationTreeService,
    OrganizationIoService,
  ],
})
export class OrganizationModule {}
