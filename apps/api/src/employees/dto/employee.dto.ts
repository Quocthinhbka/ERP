import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EducationLevel,
  EmployeeDocumentType,
  EmployeeEmploymentStatus,
  EmployeeGender,
  EmployeeProfileStatus,
  EmployeeWorkPresenceStatus,
  ETHNICITIES,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function toEnumArray<T extends string>(value: unknown): T[] | undefined {
  if (value == null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
  return items.length > 0 ? (items as T[]) : undefined;
}

export class EmployeeFamilyMemberDto {
  @IsEnum(FamilyRelationship)
  relationship!: FamilyRelationship;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  birthYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  workplace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  currentResidence?: string;
}

export class EmployeeEducationHistoryDto {
  @Matches(MONTH_PATTERN)
  fromMonth!: string;

  @Matches(MONTH_PATTERN)
  toMonth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  institution!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  major!: string;

  @IsEnum(TrainingMode)
  trainingMode!: TrainingMode;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  degree!: string;
}

export class EmployeeWorkHistoryDto {
  @Matches(MONTH_PATTERN)
  fromMonth!: string;

  @IsOptional()
  @Matches(MONTH_PATTERN)
  toMonth?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  department?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  position!: string;
}

export class EmployeeBaseDto {
  @IsOptional()
  @IsEnum(EmployeeGender)
  gender?: EmployeeGender;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  birthPlace?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  placeOfOrigin?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  permanentAddress?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  currentAddress?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsIn(ETHNICITIES)
  ethnicity?: string;

  @IsOptional()
  @IsEnum(Religion)
  religion?: Religion;

  @IsOptional()
  @Matches(/^\d{12}$/)
  identityNumber?: string;

  @IsOptional()
  @IsDateString()
  identityIssuedDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identityIssuedPlace?: string;

  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @IsOptional()
  @IsDateString()
  youthUnionAdmissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  youthUnionAdmissionPlace?: string;

  @IsOptional()
  @IsDateString()
  partyAdmissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  partyAdmissionPlace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rewardDiscipline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  strengths?: string;

  @IsOptional()
  @IsEnum(EmployeeEmploymentStatus)
  employmentStatus?: EmployeeEmploymentStatus | null;

  @IsOptional()
  @IsEnum(EmployeeWorkPresenceStatus)
  workPresenceStatus?: EmployeeWorkPresenceStatus;

  /** Giá trị trường custom: key = field code. */
  @IsOptional()
  @IsObject()
  customValues?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  linkedUserId?: string | null;
}

/** Tạo nhanh / đầy đủ: bắt buộc họ tên + SĐT + công ty chủ quản. */
export class CreateEmployeeDto extends EmployeeBaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @Matches(/^\d{10,11}$/)
  phone!: string;

  @IsUUID()
  managingCompanyId!: string;
}

/** Dialog thêm hồ sơ: họ tên + SĐT + công ty chủ quản. */
export class CheckOrCreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @Matches(/^\d{10,11}$/)
  phone!: string;

  @IsUUID()
  managingCompanyId!: string;
}

export class UpdateEmployeeDto extends EmployeeBaseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @Matches(/^\d{10,11}$/)
  phone?: string;

  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  managingCompanyId?: string;
}

export class UpdateEmployeeStatusDto {
  @IsEnum(EmployeeProfileStatus)
  status!: EmployeeProfileStatus;
}

export class UploadEmployeeDocumentDto {
  @IsEnum(EmployeeDocumentType)
  documentType!: EmployeeDocumentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

export class EmployeeCollectionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class EmployeeQueryDto extends EmployeeCollectionQueryDto {
  @IsOptional()
  @IsEnum(EmployeeProfileStatus)
  status?: EmployeeProfileStatus;

  @IsOptional()
  @Transform(({ value }) => toEnumArray<EmployeeProfileStatus>(value))
  @IsArray()
  @IsEnum(EmployeeProfileStatus, { each: true })
  statusIn?: EmployeeProfileStatus[];

  @IsOptional()
  @Transform(({ value }) => toEnumArray<EmployeeEmploymentStatus>(value))
  @IsArray()
  @IsEnum(EmployeeEmploymentStatus, { each: true })
  employmentStatusIn?: EmployeeEmploymentStatus[];

  @IsOptional()
  @Transform(({ value }) => toEnumArray<EmployeeWorkPresenceStatus>(value))
  @IsArray()
  @IsEnum(EmployeeWorkPresenceStatus, { each: true })
  workPresenceStatusIn?: EmployeeWorkPresenceStatus[];

  @IsOptional()
  @Transform(({ value }) => toEnumArray<string>(value))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  managingCompanyIdIn?: string[];
}

export class ReorderChildrenDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

export class CreateFamilyMemberDto extends EmployeeFamilyMemberDto {}

export class UpdateFamilyMemberDto {
  @IsOptional()
  @IsEnum(FamilyRelationship)
  relationship?: FamilyRelationship;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  birthYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  workplace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  currentResidence?: string;
}

export class CreateEducationHistoryDto extends EmployeeEducationHistoryDto {}

export class UpdateEducationHistoryDto {
  @IsOptional()
  @Matches(MONTH_PATTERN)
  fromMonth?: string;

  @IsOptional()
  @Matches(MONTH_PATTERN)
  toMonth?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  institution?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  major?: string;

  @IsOptional()
  @IsEnum(TrainingMode)
  trainingMode?: TrainingMode;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  degree?: string;
}

export class CreateWorkHistoryDto extends EmployeeWorkHistoryDto {}

export class UpdateWorkHistoryDto {
  @IsOptional()
  @Matches(MONTH_PATTERN)
  fromMonth?: string;

  @IsOptional()
  @Matches(MONTH_PATTERN)
  toMonth?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  department?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  position?: string;
}

export class ApplyEmployeeSelectionDto {
  @IsString()
  @IsNotEmpty()
  selectionKey!: string;
}

export class ApplyEmployeeImportDto {
  @IsString()
  @IsNotEmpty()
  snapshotJobId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyEmployeeSelectionDto)
  selections!: ApplyEmployeeSelectionDto[];
}

export class ExportEmployeeDto {
  @IsOptional()
  @IsIn(['excel', 'json'])
  format?: 'excel' | 'json';
}
