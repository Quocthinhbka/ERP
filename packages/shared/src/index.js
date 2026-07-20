"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemRole = exports.ALL_PERMISSIONS = exports.Permissions = exports.PermissionModule = void 0;
exports.hasPermission = hasPermission;
exports.hasAnyPermission = hasAnyPermission;
var PermissionModule;
(function (PermissionModule) {
    PermissionModule["SETUP"] = "setup";
    PermissionModule["USER"] = "user";
    PermissionModule["ROLE"] = "role";
})(PermissionModule || (exports.PermissionModule = PermissionModule = {}));
exports.Permissions = {
    SETUP_VIEW: 'setup:view',
    SETUP_MANAGE: 'setup:manage',
    USER_VIEW: 'user:view',
    USER_CREATE: 'user:create',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',
    ROLE_VIEW: 'role:view',
    ROLE_CREATE: 'role:create',
    ROLE_UPDATE: 'role:update',
    ROLE_DELETE: 'role:delete',
    PERMISSION_VIEW: 'permission:view',
    PERMISSION_ASSIGN: 'permission:assign',
};
exports.ALL_PERMISSIONS = Object.values(exports.Permissions);
var SystemRole;
(function (SystemRole) {
    SystemRole["SUPER_ADMIN"] = "super_admin";
    SystemRole["ADMIN"] = "admin";
    SystemRole["USER"] = "user";
})(SystemRole || (exports.SystemRole = SystemRole = {}));
function hasPermission(userPermissions, required) {
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.every((p) => userPermissions.includes(p));
}
function hasAnyPermission(userPermissions, required) {
    return required.some((p) => userPermissions.includes(p));
}
//# sourceMappingURL=index.js.map