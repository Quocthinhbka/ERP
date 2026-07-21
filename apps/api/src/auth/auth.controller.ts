import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  BootstrapAdminDto,
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import {
  AllowPasswordChangeRequired,
  JwtAuthGuard,
} from '../common/guards/auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from './auth-cookies';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('bootstrap')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async bootstrap(
    @Body() dto: BootstrapAdminDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.bootstrapAdmin(dto);
    setAuthCookies(
      res,
      result,
      this.authService.accessExpiresIn,
      this.authService.refreshExpiresIn,
    );
    return result;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    setAuthCookies(
      res,
      result,
      this.authService.accessExpiresIn,
      this.authService.refreshExpiresIn,
    );
    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto = {},
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken ||
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ||
      '';
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(
      res,
      tokens,
      this.authService.accessExpiresIn,
      this.authService.refreshExpiresIn,
    );
    return tokens;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto = {},
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken ||
      (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    await this.authService.logout(refreshToken);
    clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  @AllowPasswordChangeRequired()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Post('change-password')
  @HttpCode(200)
  @AllowPasswordChangeRequired()
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.id, dto);
    setAuthCookies(
      res,
      result,
      this.authService.accessExpiresIn,
      this.authService.refreshExpiresIn,
    );
    return result;
  }
}
