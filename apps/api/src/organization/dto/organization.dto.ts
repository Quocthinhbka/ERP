import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EntityStatus } from '@erp/shared';

export class OrganizationMemberDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsString()
  @IsNotEmpty()
  memberName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class CompanyMemberDto extends OrganizationMemberDto {
  @IsOptional()
  @IsUUID()
  linkedProfileUserId?: string | null;
}

export class UnitMemberDto extends CompanyMemberDto {}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  @IsOptional()
  @IsUUID()
  linkedProfileUserId?: string | null;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrganizationMemberDto)
  members?: OrganizationMemberDto[];
}

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  @IsOptional()
  @IsUUID()
  linkedProfileUserId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyMemberDto)
  members?: CompanyMemberDto[];
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  @IsOptional()
  @IsUUID()
  linkedProfileUserId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyMemberDto)
  members?: CompanyMemberDto[];
}

export class CreateOrganizationUnitDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  parentUnitId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsUUID()
  linkedProfileUserId?: string;

  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class UpdateOrganizationUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsUUID()
  linkedProfileUserId?: string | null;

  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnitMemberDto)
  members?: UnitMemberDto[];
}

export class ReorderNodeDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

export class ApplyOrganizationImportDto {
  @IsString()
  @IsNotEmpty()
  snapshotPath!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplySelectionDto)
  selections!: ApplySelectionDto[];
}

export class ApplySelectionDto {
  @IsString()
  @IsNotEmpty()
  selectionKey!: string;
}
