import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
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
  EmployeeGender,
  ETHNICITIES,
  EntityStatus,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

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
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName?: string;

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
  @Matches(/^\d{10,11}$/)
  phone?: string;

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
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @IsOptional()
  @IsUUID()
  linkedUserId?: string | null;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsEnum(EmployeeGender)
  gender!: EmployeeGender;

  @IsDateString()
  birthDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  birthPlace!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  placeOfOrigin!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  permanentAddress!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  currentAddress!: string;

  @Matches(/^\d{10,11}$/)
  phone!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsIn(ETHNICITIES)
  ethnicity!: string;

  @IsOptional()
  @IsEnum(Religion)
  religion?: Religion;

  @Matches(/^\d{12}$/)
  identityNumber!: string;

  @IsDateString()
  identityIssuedDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identityIssuedPlace!: string;

  @IsEnum(EducationLevel)
  educationLevel!: EducationLevel;

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
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @IsOptional()
  @IsUUID()
  linkedUserId?: string | null;
}

export class UpdateEmployeeDto extends EmployeeBaseDto {}

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
  @IsEnum(EntityStatus)
  status?: EntityStatus;
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
