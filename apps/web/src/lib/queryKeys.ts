/** Query keys dùng chung — tránh typo khi invalidate. */
export const queryKeys = {
  accounts: ['accounts'] as const,
  account: (id: string) => ['accounts', id] as const,
  accountPermissions: (id: string) => ['accounts', id, 'permissions'] as const,
  availableEmployeeProfiles: ['users', 'available-employee-profiles'] as const,
  employees: (
    page: number,
    pageSize: number,
    search: string,
    filters: {
      statusIn: string[];
      employmentStatusIn: string[];
      workPresenceStatusIn: string[];
      managingCompanyIdIn: string[];
    },
  ) =>
    [
      'employees',
      page,
      pageSize,
      search,
      filters.statusIn.join(','),
      filters.employmentStatusIn.join(','),
      filters.workPresenceStatusIn.join(','),
      filters.managingCompanyIdIn.join(','),
    ] as const,
  employee: (id: string) => ['employees', id] as const,
  personalProfile: ['personal', 'profile'] as const,
  permissionGroups: ['permission-groups'] as const,
  permissionsCatalog: ['permissions', 'catalog'] as const,
  permissionsGrouped: ['permissions', 'grouped'] as const,
  organizationTree: (search?: string) => ['organization', 'tree', search ?? ''] as const,
  organizationUsers: ['organization', 'users-linked'] as const,
  organizationPermissionGroups: ['organization', 'permission-groups'] as const,
  employeeProfileLayout: ['employee-profile-layout'] as const,
  employeeFamily: (
    endpoint: string,
    page: number,
    pageSize: number,
    search: string,
  ) => ['employee-family', endpoint, page, pageSize, search] as const,
  employeeEducation: (
    endpoint: string,
    page: number,
    pageSize: number,
    search: string,
  ) => ['employee-education', endpoint, page, pageSize, search] as const,
  employeeWork: (
    endpoint: string,
    page: number,
    pageSize: number,
    search: string,
  ) => ['employee-work', endpoint, page, pageSize, search] as const,
};
