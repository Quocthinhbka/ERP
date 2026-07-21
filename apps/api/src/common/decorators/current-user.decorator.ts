import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgScopeNode, PermissionCode } from '@erp/shared';

export interface RequestUser {
  id: string;
  email: string;
  permissions: PermissionCode[];
  isSystemAdmin: boolean;
  orgScopes: OrgScopeNode[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);
