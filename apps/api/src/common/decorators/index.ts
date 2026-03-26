import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant.middleware';

export const PERMISSIONS_KEY = 'permissions';
export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'isPublic';
export const SUPER_ADMIN_KEY = 'isSuperAdmin';

/**
 * Mark route as public (no JWT required)
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Require super admin role
 */
export const SuperAdmin = () => SetMetadata(SUPER_ADMIN_KEY, true);

/**
 * Require specific permissions
 * @example @RequirePermissions('po:create', 'po:view')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Get current authenticated user from request
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

/**
 * Get current tenant ID from request
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    return request.tenantId;
  },
);
