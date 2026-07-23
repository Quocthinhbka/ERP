import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeesModule } from '../employees/employees.module';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';

@Module({
  imports: [AuthModule, EmployeesModule],
  controllers: [PersonalController],
  providers: [PersonalService],
})
export class PersonalModule {}
