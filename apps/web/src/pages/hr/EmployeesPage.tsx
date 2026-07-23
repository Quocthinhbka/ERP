import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMPLOYMENT_STATUS_LABELS,
  EmployeeEmploymentStatus,
  Permissions,
  WORK_PRESENCE_STATUS_LABELS,
  type EmployeeWorkPresenceStatus,
} from '@erp/shared';
import { excelEnumColumnFilter } from '../../components/ExcelEnumColumnFilter';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { appendArrayParams } from '../../lib/list-query-params';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../../contexts/AuthContext';
import type { EmployeeListItem, EmployeeListPage, EmployeeStatus } from './employee-types';
import { EmployeeIoActions } from './EmployeeIoActions';
import { EmployeeCreateDialog } from './EmployeeCreateDialog';
import { resolveAvatarSrc } from './EmployeeAvatarField';
import {
  EMPLOYMENT_STATUS_FILTER_OPTIONS,
  PROFILE_STATUS_OPTIONS,
  WORK_PRESENCE_FILTER_OPTIONS,
  profileStatusColor,
  profileStatusLabel,
} from './employee-catalogs';

const isDevelopment = import.meta.env.DEV;

/** Độ rộng cột list nhân sự: số ký tự dự kiến × 8px + padding. */
const COL_CHAR_PX = 8;
const COL_PAD_PX = 16;
function employeeListColWidth(chars: number) {
  return chars * COL_CHAR_PX + COL_PAD_PX;
}

const EMPLOYEE_LIST_COL = {
  profileCode: employeeListColWidth(12),
  avatar: employeeListColWidth(8),
  fullName: employeeListColWidth(22),
  phone: employeeListColWidth(15),
  company: employeeListColWidth(40),
  profileStatus: employeeListColWidth(18),
  employmentStatus: employeeListColWidth(20),
  workPresence: employeeListColWidth(20),
  actions: employeeListColWidth(18),
} as const;

const EMPLOYEE_LIST_SCROLL_X = Object.values(EMPLOYEE_LIST_COL).reduce(
  (sum, width) => sum + width,
  0,
);

/** ~90% chiều cao 1 dòng bảng (middle ≈ 54px), căn giữa theo chiều dọc như cột Mã hồ sơ. */
const EMPLOYEE_TABLE_ROW_PX = 54;
const EMPLOYEE_LIST_AVATAR_PX = Math.round(EMPLOYEE_TABLE_ROW_PX * 0.9);

/** Chiều cao thead + pagination (ước lượng) khi tính scroll.y. */
const TABLE_HEAD_PX = 55;
const TABLE_PAGINATION_PX = 56;

const PROFILE_STATUS_FILTER_OPTIONS = PROFILE_STATUS_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label,
}));

function employmentFormLabel(value?: string | null) {
  if (!value) return '—';
  return (
    EMPLOYMENT_STATUS_LABELS[value as EmployeeEmploymentStatus] ?? value
  );
}

function workPresenceLabel(value?: string | null) {
  if (!value) return '—';
  return (
    WORK_PRESENCE_STATUS_LABELS[value as EmployeeWorkPresenceStatus] ?? value
  );
}

async function fetchEmployees(params: {
  page: number;
  pageSize: number;
  search?: string;
  statusIn: string[];
  employmentStatusIn: string[];
  workPresenceStatusIn: string[];
  managingCompanyIdIn: string[];
}) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.search) qs.set('search', params.search);
  appendArrayParams(qs, 'statusIn', params.statusIn);
  appendArrayParams(qs, 'employmentStatusIn', params.employmentStatusIn);
  appendArrayParams(qs, 'workPresenceStatusIn', params.workPresenceStatusIn);
  appendArrayParams(qs, 'managingCompanyIdIn', params.managingCompanyIdIn);
  const { data } = await api.get<EmployeeListPage>(`/employees?${qs.toString()}`);
  return data;
}

interface CompanyOption {
  id: string;
  name: string;
}

export function EmployeesPage() {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusIn, setStatusIn] = useState<string[]>([]);
  const [employmentStatusIn, setEmploymentStatusIn] = useState<string[]>([]);
  const [workPresenceStatusIn, setWorkPresenceStatusIn] = useState<string[]>([]);
  const [managingCompanyIdIn, setManagingCompanyIdIn] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(360);

  useLayoutEffect(() => {
    const node = tableWrapRef.current;
    if (!node) return;

    const update = () => {
      setTableScrollY(
        Math.max(200, node.clientHeight - TABLE_HEAD_PX - TABLE_PAGINATION_PX),
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const runSearch = () => {
    setPage(1);
    void refetch();
  };

  const listCellStyle = { verticalAlign: 'middle' as const, padding: '4px 8px' };

  const listFilters = {
    statusIn,
    employmentStatusIn,
    workPresenceStatusIn,
    managingCompanyIdIn,
  };
  const queryKey = queryKeys.employees(page, pageSize, search.trim(), listFilters);

  const { data: companies = [] } = useQuery({
    queryKey: ['organization', 'companies'],
    queryFn: async () => {
      const { data } = await api.get<CompanyOption[]>('/organization/companies');
      return data;
    },
  });

  const companyFilterOptions = useMemo(
    () => companies.map((company) => ({ value: company.id, label: company.name })),
    [companies],
  );

  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      fetchEmployees({
        page,
        pageSize,
        search: search.trim() || undefined,
        ...listFilters,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    if (isError) {
      message.error(getApiErrorMessage(error, 'Không tải được danh sách nhân viên'));
    }
  }, [isError, error]);

  useEffect(() => {
    void refetch();
  }, [location.key, refetch]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void refetch();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refetch]);

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const applyFilter = (setter: (values: string[]) => void) => (values: string[]) => {
    setter(values);
    setPage(1);
  };

  const canCreate = hasPermission(Permissions.HR_EMPLOYEE_CREATE);
  const canExport = hasPermission(Permissions.HR_EMPLOYEE_EXPORT);
  const canImport = hasPermission(Permissions.HR_EMPLOYEE_IMPORT);

  return (
    <Card
      data-testid="employees-page"
      style={{
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        header: { flexShrink: 0 },
        body: {
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 12,
        },
        title: { width: '100%' },
      }}
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap' }}>
            Quản lý nhân sự
          </span>
          <Input
            placeholder="Tìm theo tên, mã, SĐT..."
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={runSearch}
            style={{ width: 260 }}
            data-testid="employee-search-input"
          />
          <Button type="primary" onClick={runSearch}>
            Tìm
          </Button>
          <Space wrap style={{ marginLeft: 'auto' }}>
            <EmployeeIoActions
              canExport={canExport}
              canImport={canImport}
              onApplied={invalidateList}
            />
            {canCreate ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                data-testid="employee-create-btn"
                onClick={() => setCreateOpen(true)}
              >
                Thêm hồ sơ mới
              </Button>
            ) : null}
          </Space>
        </div>
      }
    >
      <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          tableLayout="fixed"
          scroll={{ x: EMPLOYEE_LIST_SCROLL_X, y: tableScrollY }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          columns={[
            {
              title: 'Mã hồ sơ',
              dataIndex: 'profileCode',
              width: EMPLOYEE_LIST_COL.profileCode,
              ellipsis: true,
              onCell: () => ({ style: listCellStyle }),
            },
            {
              title: 'Ảnh',
              width: EMPLOYEE_LIST_COL.avatar,
              align: 'center',
              onCell: () => ({ style: listCellStyle }),
              render: (_: unknown, record: EmployeeListItem) => (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: EMPLOYEE_TABLE_ROW_PX,
                  }}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    src={resolveAvatarSrc(record.avatarUrl)}
                    style={{
                      width: EMPLOYEE_LIST_AVATAR_PX,
                      height: EMPLOYEE_LIST_AVATAR_PX,
                      lineHeight: `${EMPLOYEE_LIST_AVATAR_PX}px`,
                      flexShrink: 0,
                    }}
                  />
                </div>
              ),
            },
          {
            title: 'Họ và tên',
            dataIndex: 'fullName',
            width: EMPLOYEE_LIST_COL.fullName,
            ellipsis: true,
            render: (name: string) => (
              <Tooltip title={name}>
                <span>{name}</span>
              </Tooltip>
            ),
          },
          {
            title: 'Số điện thoại',
            dataIndex: 'phone',
            width: EMPLOYEE_LIST_COL.phone,
            ellipsis: true,
            render: (phone: string | null) => {
              const text = phone ?? '—';
              return (
                <Tooltip title={text}>
                  <span>{text}</span>
                </Tooltip>
              );
            },
          },
          {
            title: 'Công ty chủ quản',
            width: EMPLOYEE_LIST_COL.company,
            ellipsis: true,
            ...excelEnumColumnFilter<EmployeeListItem>({
              options: companyFilterOptions,
              filteredValue: managingCompanyIdIn,
              onApply: applyFilter(setManagingCompanyIdIn),
            }),
            render: (_: unknown, record: EmployeeListItem) => {
              const text = record.managingCompany?.name ?? '—';
              return (
                <Tooltip title={text}>
                  <span>{text}</span>
                </Tooltip>
              );
            },
          },
          {
            title: 'Trạng thái hồ sơ',
            dataIndex: 'status',
            width: EMPLOYEE_LIST_COL.profileStatus,
            ellipsis: true,
            ...excelEnumColumnFilter<EmployeeListItem>({
              options: PROFILE_STATUS_FILTER_OPTIONS,
              filteredValue: statusIn,
              onApply: applyFilter(setStatusIn),
            }),
            render: (value: EmployeeStatus) => (
              <Tag color={profileStatusColor(value)}>{profileStatusLabel(value)}</Tag>
            ),
          },
          {
            title: 'Hình thức làm việc',
            width: EMPLOYEE_LIST_COL.employmentStatus,
            ellipsis: true,
            ...excelEnumColumnFilter<EmployeeListItem>({
              options: EMPLOYMENT_STATUS_FILTER_OPTIONS,
              filteredValue: employmentStatusIn,
              onApply: applyFilter(setEmploymentStatusIn),
            }),
            render: (_: unknown, record: EmployeeListItem) => {
              const text = employmentFormLabel(record.employmentStatus);
              return (
                <Tooltip title={text}>
                  <span>{text}</span>
                </Tooltip>
              );
            },
          },
          {
            title: 'Trạng thái làm việc',
            width: EMPLOYEE_LIST_COL.workPresence,
            ellipsis: true,
            ...excelEnumColumnFilter<EmployeeListItem>({
              options: WORK_PRESENCE_FILTER_OPTIONS,
              filteredValue: workPresenceStatusIn,
              onApply: applyFilter(setWorkPresenceStatusIn),
            }),
            render: (_: unknown, record: EmployeeListItem) => {
              const text = workPresenceLabel(record.workPresenceStatus);
              return (
                <Tooltip title={text}>
                  <span>{text}</span>
                </Tooltip>
              );
            },
          },
          {
            title: 'Thao tác',
            width: EMPLOYEE_LIST_COL.actions,
            render: (_: unknown, record: EmployeeListItem) => (
              <Space>
                <Tooltip title="Xem chi tiết">
                  <Link to={`/hr/employees/${record.id}`}>
                    <Button size="small" icon={<EyeOutlined />} data-testid="employee-view-btn" />
                  </Link>
                </Tooltip>
                {isDevelopment && hasPermission(Permissions.HR_EMPLOYEE_DELETE) ? (
                  <Tooltip title="Xóa cứng (dev)">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        Modal.confirm({
                          title: 'Xóa cứng hồ sơ?',
                          content: `Xóa vĩnh viễn ${record.fullName}?`,
                          okType: 'danger',
                          onOk: async () => {
                            try {
                              await api.delete(`/employees/${record.id}/hard`);
                              message.success('Đã xóa');
                              invalidateList();
                            } catch (err) {
                              message.error(getApiErrorMessage(err, 'Không xóa được'));
                            }
                          },
                        });
                      }}
                    />
                  </Tooltip>
                ) : null}
              </Space>
            ),
          },
        ]}
        />
      </div>

      <EmployeeCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </Card>
  );
}
