export declare enum PermissionModule {
    SETUP = "setup",
    USER = "user",
    ROLE = "role"
}
export declare const Permissions: {
    readonly SETUP_VIEW: "setup:view";
    readonly SETUP_MANAGE: "setup:manage";
    readonly USER_VIEW: "user:view";
    readonly USER_CREATE: "user:create";
    readonly USER_UPDATE: "user:update";
    readonly USER_DELETE: "user:delete";
    readonly ROLE_VIEW: "role:view";
    readonly ROLE_CREATE: "role:create";
    readonly ROLE_UPDATE: "role:update";
    readonly ROLE_DELETE: "role:delete";
    readonly PERMISSION_VIEW: "permission:view";
    readonly PERMISSION_ASSIGN: "permission:assign";
};
export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];
export declare const ALL_PERMISSIONS: PermissionCode[];
export declare enum SystemRole {
    SUPER_ADMIN = "super_admin",
    ADMIN = "admin",
    USER = "user"
}
export interface JwtPayload {
    sub: string;
    email: string;
    permissions: PermissionCode[];
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
export declare function hasPermission(userPermissions: PermissionCode[], required: PermissionCode | PermissionCode[]): boolean;
export declare function hasAnyPermission(userPermissions: PermissionCode[], required: PermissionCode[]): boolean;
//# sourceMappingURL=index.d.ts.map