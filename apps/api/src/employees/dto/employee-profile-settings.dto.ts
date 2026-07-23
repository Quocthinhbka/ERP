import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmployeeProfileFieldDataType } from '@erp/shared';

export class CreateProfileTabDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class UpdateProfileTabDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderProfileTabsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  tabIds!: string[];
}

export class CreateProfileFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsEnum(EmployeeProfileFieldDataType)
  dataType!: EmployeeProfileFieldDataType;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Gán vào các tab ngay khi tạo (có thể nhiều tab). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  tabIds?: string[];
}

export class UpdateProfileFieldDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(EmployeeProfileFieldDataType)
  dataType?: EmployeeProfileFieldDataType;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Thay toàn bộ danh sách tab chứa field. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  tabIds?: string[];
}

export class AttachFieldToTabDto {
  @IsUUID()
  fieldDefId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderTabFieldsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  fieldDefIds!: string[];
}

/** Legacy bulk toggle — giữ để tương thích tạm. */
export class EmployeeProfileFieldSettingItemDto {
  @IsString()
  fieldKey!: string;

  @IsBoolean()
  visible!: boolean;

  @IsBoolean()
  required!: boolean;
}

export class ReplaceEmployeeProfileFieldSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeProfileFieldSettingItemDto)
  items!: EmployeeProfileFieldSettingItemDto[];
}
