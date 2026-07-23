/** Layout tokens dùng chung — giảm magic numbers inline. */
export const layoutTokens = {
  siderWidth: 240,
  siderCollapsedWidth: 72,
  headerHeight: 48,
  contentMargin: 12,
  contentPadding: 12,
} as const;

export const pageHeights = {
  organizationPage: `calc(100vh - ${layoutTokens.headerHeight + 48}px)`,
} as const;
