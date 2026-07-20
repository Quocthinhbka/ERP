import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { CompaniesService } from './companies.service';
import { OrganizationUnitsService } from './organization-units.service';
import { OrganizationTreeService } from './organization-tree.service';
import { OrgCodeService } from './org-code.service';

@Module({
  controllers: [OrganizationController],
  providers: [
    OrganizationService,
    CompaniesService,
    OrganizationUnitsService,
    OrganizationTreeService,
    OrgCodeService,
  ],
})
export class OrganizationModule {}
