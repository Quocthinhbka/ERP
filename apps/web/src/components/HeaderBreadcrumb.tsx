import { Fragment, type CSSProperties } from 'react';
import { Dropdown, Typography, theme } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import type { BreadcrumbSegment } from '../lib/nav-breadcrumb';

type Props = {
  segments: BreadcrumbSegment[];
};

export function HeaderBreadcrumb({ segments }: Props) {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      data-testid="header-breadcrumb"
      aria-label="Đường dẫn trang"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        minWidth: 0,
        flex: 1,
        lineHeight: 1.4,
      }}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const hasSiblings = segment.siblings.length > 1;
        const separator = index > 0 ? (
          <Typography.Text type="secondary" style={{ userSelect: 'none' }}>
            /
          </Typography.Text>
        ) : null;

        const labelStyle: CSSProperties = {
          fontSize: 14,
          fontWeight: isLast ? 600 : 400,
          color: isLast ? token.colorText : token.colorTextSecondary,
          cursor: segment.path && !isLast ? 'pointer' : hasSiblings ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
        };

        const label = (
          <span
            style={labelStyle}
            data-testid={isLast ? 'header-breadcrumb-current' : undefined}
            onClick={() => {
              if (segment.path && !isLast) {
                navigate(segment.path);
              }
            }}
            onKeyDown={(event) => {
              if (segment.path && !isLast && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                navigate(segment.path);
              }
            }}
            role={segment.path && !isLast ? 'link' : undefined}
            tabIndex={segment.path && !isLast ? 0 : undefined}
          >
            {segment.label}
            {hasSiblings ? (
              <DownOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.65 }} />
            ) : null}
          </span>
        );

        if (hasSiblings) {
          return (
            <Fragment key={segment.key}>
              {separator}
              <Dropdown
                menu={{
                  items: segment.siblings.map((sibling) => ({
                    key: sibling.key,
                    label: sibling.label,
                    onClick: () => navigate(sibling.path),
                  })),
                }}
                trigger={['hover']}
              >
                {label}
              </Dropdown>
            </Fragment>
          );
        }

        return (
          <Fragment key={segment.key}>
            {separator}
            {label}
          </Fragment>
        );
      })}
    </nav>
  );
}
