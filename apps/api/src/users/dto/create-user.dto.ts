import { IsUUID } from 'class-validator';

export class CreateUserDto {
  @IsUUID()
  employeeProfileId!: string;
}
