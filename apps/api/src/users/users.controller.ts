import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '@erp/shared';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../common/guards/auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permissions.USER_VIEW)
  findAll(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
    @Query('hasLinkedProfile') hasLinkedProfile?: string,
  ) {
    const pageNum = Math.max(Number(page) || 1, 1);
    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 200);
    const linkedOnly =
      hasLinkedProfile === '1' ||
      hasLinkedProfile === 'true' ||
      hasLinkedProfile === 'yes';
    return this.usersService.findAll(pageNum, size, search, linkedOnly);
  }

  @Get('available-employee-profiles')
  @RequirePermissions(Permissions.USER_CREATE, Permissions.USER_UPDATE)
  findAvailableEmployeeProfiles() {
    return this.usersService.findAvailableEmployeeProfiles();
  }

  @Get(':id/permissions')
  @RequirePermissions(Permissions.USER_VIEW, Permissions.PERMISSION_ASSIGN)
  getPermissions(@Param('id') id: string) {
    return this.usersService.getPermissions(id);
  }

  @Get(':id')
  @RequirePermissions(Permissions.USER_VIEW)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permissions.USER_CREATE)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.USER_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.USER_DELETE)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
