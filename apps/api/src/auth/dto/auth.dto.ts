import { IsNotEmpty, IsOptional, IsString, MinLength, IsEmail, IsArray } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

/** Chỉ dùng khi DB chưa có user nào — tạo Super Admin đầu tiên. */
export class BootstrapAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class RefreshTokenDto {
  /** Có thể bỏ trống khi refresh token nằm trong HttpOnly cookie. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}
