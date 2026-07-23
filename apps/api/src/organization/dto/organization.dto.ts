import {
  IsArray,
  IsBoolean,
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
import { EntityStatus, OrgNodeType } from '@erp/shared';

export class OrgScopeNodeDto {
  @IsEnum(OrgNodeType)
  type!: OrgNodeType;

  @IsUUID()
  id!: string;
}

export class PositionPermissionInputDto {
  @IsOptional()
  @IsUUID()
  permissionGroupId?: string | null;

  @IsOptional()
  @IsUUID()
  permissionGroupVersionId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];

  @IsOptional()
  @IsBoolean()
  includeSelf?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrgScopeNodeDto)
  parentScopes?: OrgScopeNodeDto[];
}

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
  @IsUUID()
  linkedProfileUserId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionPermissionInputDto)
  positionPermission?: PositionPermissionInputDto | null;
}

export class CompanyMemberDto extends OrganizationMemberDto {}

export class UnitMemberDto extends OrganizationMemberDto {}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionPermissionInputDto)
  positionPermission?: PositionPermissionInputDto | null;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionPermissionInputDto)
  positionPermission?: PositionPermissionInputDto | null;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionPermissionInputDto)
  positionPermission?: PositionPermissionInputDto | null;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionPermissionInputDto)
  positionPermission?: PositionPermissionInputDto | null;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionPermissionInputDto)
  positionPermission?: PositionPermissionInputDto | null;
}

export class ReorderNodeDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

export class ApplyOrganizationImportDto {
  @IsString()
  @IsNotEmpty()
  snapshotJobId!: string;

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

export class ExportOrganizationDto {
  @IsOptional()
  @IsIn(['excel', 'json'])
  format?: 'excel' | 'json';
}
