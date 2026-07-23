import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '@erp/shared';
import {
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../common/guards/auth.guard';
import {
  AttachFieldToTabDto,
  CreateProfileFieldDto,
  CreateProfileTabDto,
  ReorderProfileTabsDto,
  ReorderTabFieldsDto,
  ReplaceEmployeeProfileFieldSettingsDto,
  UpdateProfileFieldDto,
  UpdateProfileTabDto,
} from './dto/employee-profile-settings.dto';
import { EmployeeProfileSettingsService } from './employee-profile-settings.service';

@Controller('employee-profile-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeProfileSettingsController {
  constructor(private readonly settings: EmployeeProfileSettingsService) {}

  /** Layout đầy đủ: tabs + fields (Form/Thiết lập). */
  @Get()
  layout() {
    return this.settings.getLayout();
  }

  @Post('tabs')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  createTab(@Body() dto: CreateProfileTabDto) {
    return this.settings.createTab(dto);
  }

  @Patch('tabs/:id')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  updateTab(@Param('id') id: string, @Body() dto: UpdateProfileTabDto) {
    return this.settings.updateTab(id, dto);
  }

  @Delete('tabs/:id')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  deleteTab(@Param('id') id: string) {
    return this.settings.deleteTab(id);
  }

  @Put('tabs/reorder')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  reorderTabs(@Body() dto: ReorderProfileTabsDto) {
    return this.settings.reorderTabs(dto.tabIds);
  }

  @Post('fields')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  createField(@Body() dto: CreateProfileFieldDto) {
    return this.settings.createField(dto);
  }

  @Patch('fields/:id')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  updateField(@Param('id') id: string, @Body() dto: UpdateProfileFieldDto) {
    return this.settings.updateField(id, dto);
  }

  @Delete('fields/:id')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  deleteField(@Param('id') id: string) {
    return this.settings.deleteField(id);
  }

  @Post('tabs/:tabId/fields')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  attachField(@Param('tabId') tabId: string, @Body() dto: AttachFieldToTabDto) {
    return this.settings.attachFieldToTab(tabId, dto);
  }

  @Delete('tabs/:tabId/fields/:fieldDefId')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  detachField(
    @Param('tabId') tabId: string,
    @Param('fieldDefId') fieldDefId: string,
  ) {
    return this.settings.detachFieldFromTab(tabId, fieldDefId);
  }

  @Put('tabs/:tabId/fields/reorder')
  @RequirePermissions(Permissions.SETUP_MANAGE)
  reorderTabFields(
    @Param('tabId') tabId: string,
    @Body() dto: ReorderTabFieldsDto,
  ) {
    return this.settings.reorderTabFields(tabId, dto.fieldDefIds);
  }

  /** Legacy bulk visible/required — trả về layout mới. */
  @Put()
  @RequirePermissions(Permissions.SETUP_MANAGE)
  replace(@Body() dto: ReplaceEmployeeProfileFieldSettingsDto) {
    return this.settings.replaceAll(dto.items);
  }
}
