import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeIoService } from './employee-io.service';
import { EmployeeProfileSettingsController } from './employee-profile-settings.controller';
import { EmployeeProfileSettingsService } from './employee-profile-settings.service';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [EmployeesController, EmployeeProfileSettingsController],
  providers: [
    EmployeesService,
    EmployeeIoService,
    EmployeeProfileSettingsService,
  ],
  exports: [EmployeesService, EmployeeProfileSettingsService],
})
export class EmployeesModule {}
