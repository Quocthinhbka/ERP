import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PermissionCode } from '@erp/shared';

export interface RequestUser {
  id: string;
  email: string;
  permissions: PermissionCode[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);
