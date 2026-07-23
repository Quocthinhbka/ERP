import {
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BankOutlined,
  ClusterOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Card, Descriptions, Form, Input, Select, Space, Typography } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { EntityStatus, OrgNodeType, OrgTreeNode, Permissions, type PermissionCode } from '@erp/shared';
import {
  EmployeesViewList,
  LinkedProfileSelect,
  MembersFormList,
  MembersViewList,
  PositionPermissionFields,
  displayManagerName,
  displayText,
  formatPositionPermissionSummary,
  statusTag,
  type SelectedNode,
  type UserOption,
} from './index';
import type { ScopeTreeOption } from './types';

type OrganizationDetailPanelProps = {
  isDesktopLayout: boolean;
  selected: SelectedNode | null;
  treeData: OrgTreeNode | null;
  isEditing: boolean;
  form: FormInstance;
  users: UserOption[];
  permissionGroupOptions: Array<{ value: string; label: string }>;
  selectedScopeTreeOptions: ScopeTreeOption[];
  canUpdateSelected: boolean;
  canReorderSelected: boolean;
  canDeleteMember: boolean;
  canDeleteUnit: boolean;
  canShowAddUnit: boolean;
  siblingInfo: { index: number; total: number } | null;
  hasPermission: (permission: PermissionCode) => boolean;
  linkedUserLabel: (userId?: string | null, fallbackName?: string | null) => string;
  onStartEdit: () => void;
  onDelete: () => void;
  onDeleteMember: () => void;
  onAddCompany: () => void;
  onAddUnit: () => void;
  onOpenEmployeeModal: () => void;
  onSave: (values: Record<string, unknown>) => void;
  onCancelEdit: () => void;
  onReorder: (direction: 'up' | 'down') => void;
};

export function OrganizationDetailPanel({
  isDesktopLayout,
  selected,
  treeData,
  isEditing,
  form,
  users,
  permissionGroupOptions,
  selectedScopeTreeOptions,
  canUpdateSelected,
  canReorderSelected,
  canDeleteMember,
  canDeleteUnit,
  canShowAddUnit,
  siblingInfo,
  hasPermission,
  linkedUserLabel,
  onStartEdit,
  onDelete,
  onDeleteMember,
  onAddCompany,
  onAddUnit,
  onOpenEmployeeModal,
  onSave,
  onCancelEdit,
  onReorder,
}: OrganizationDetailPanelProps) {
  const renderReorderButtons = () => {
    if (!canReorderSelected || isEditing || !siblingInfo) return null;
    const canMoveUp = siblingInfo.index > 0;
    const canMoveDown = siblingInfo.index < siblingInfo.total - 1;
    return (
      <Space size={4}>
        <Button
          size="small"
          icon={<ArrowUpOutlined />}
          title="Lên trên"
          disabled={!canMoveUp}
          onClick={() => onReorder('up')}
        />
        <Button
          size="small"
          icon={<ArrowDownOutlined />}
          title="Xuống dưới"
          disabled={!canMoveDown}
          onClick={() => onReorder('down')}
        />
      </Space>
    );
  };

  const renderPanelExtra = () => {
    if (!selected) return null;

    if (selected.member) {
      return (
        <Space wrap size={4}>
          {canUpdateSelected && !isEditing && (
            <Button
              size="small"
              icon={<EditOutlined />}
              title="Sửa"
              onClick={onStartEdit}
            />
          )}
          {canDeleteMember && !isEditing && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Xóa"
              onClick={onDeleteMember}
            />
          )}
        </Space>
      );
    }

    return (
      <Space wrap size={4}>
        {selected.type === OrgNodeType.ORGANIZATION &&
          hasPermission(Permissions.COMPANY_CREATE) &&
          !isEditing && (
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAddCompany}>
              Thêm công ty
            </Button>
          )}
        {selected.type === OrgNodeType.UNIT &&
          hasPermission(Permissions.ORG_UNIT_UPDATE) &&
          !isEditing && (
          <Button size="small" icon={<PlusOutlined />} onClick={onOpenEmployeeModal}>
            Thêm nhân viên
          </Button>
        )}
        {canShowAddUnit && (
          <Button size="small" icon={<PlusOutlined />} onClick={onAddUnit}>
            Thêm đơn vị
          </Button>
        )}
        {canUpdateSelected && !isEditing && (
          <Button size="small" icon={<EditOutlined />} title="Sửa" onClick={onStartEdit} />
        )}
        {selected.type === OrgNodeType.COMPANY && hasPermission(Permissions.COMPANY_DELETE) && (
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            title="Xóa"
            onClick={onDelete}
          />
        )}
        {selected.type === OrgNodeType.UNIT &&
          hasPermission(Permissions.ORG_UNIT_DELETE) &&
          canDeleteUnit && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Xóa"
              onClick={onDelete}
            />
          )}
      </Space>
    );
  };

  const renderEditForm = () => {
    if (!selected) return null;
    if (selected.member) {
      return (
        <>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="position" label="Chức vụ" rules={[{ required: true, message: 'Nhập chức vụ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="linkedProfileUserId" label="Tài khoản liên kết">
            <LinkedProfileSelect
              users={users}
              nameField="memberName"
              phoneField="phone"
              emailField="email"
            />
          </Form.Item>
          <Form.Item name="memberName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="phone" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="email" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="additionalInfo" label="Thông tin thêm">
            <Input.TextArea rows={2} />
          </Form.Item>
          <PositionPermissionFields
            namePath="positionPermission"
            groupOptions={permissionGroupOptions}
            scopeTreeOptions={selectedScopeTreeOptions}
          />
        </>
      );
    }
    if (selected.type === OrgNodeType.ORGANIZATION) {
      return (
        <>
          <Form.Item name="name" label="Tên tổ chức" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="linkedProfileUserId" label="Tài khoản liên kết (người đại diện)">
            <LinkedProfileSelect users={users} nameField="representativeName" />
          </Form.Item>
          <Form.Item name="representativeName" hidden>
            <Input />
          </Form.Item>
          <PositionPermissionFields
            namePath="positionPermission"
            groupOptions={permissionGroupOptions}
            scopeTreeOptions={selectedScopeTreeOptions}
          />
          <Form.Item name="additionalInfo" label="Thông tin thêm">
            <Input.TextArea rows={3} />
          </Form.Item>
          <MembersFormList withLinkedProfile withPositionPermission users={users} groupOptions={permissionGroupOptions} scopeTreeOptions={selectedScopeTreeOptions} />
        </>
      );
    }
    if (selected.type === OrgNodeType.COMPANY) {
      return (
        <>
          <Form.Item name="name" label="Tên công ty" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="taxId" label="Mã số thuế">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="linkedProfileUserId" label="Tài khoản liên kết (người đại diện)">
            <LinkedProfileSelect
              users={users}
              nameField="representativeName"
              phoneField="phone"
              emailField="email"
            />
          </Form.Item>
          <Form.Item name="representativeName" hidden>
            <Input />
          </Form.Item>
          <PositionPermissionFields
            namePath="positionPermission"
            groupOptions={permissionGroupOptions}
            scopeTreeOptions={selectedScopeTreeOptions}
          />
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái hoạt động" rules={[{ required: true }]}>
            <Select
              options={[
                { value: EntityStatus.ACTIVE, label: 'Hoạt động' },
                { value: EntityStatus.INACTIVE, label: 'Ngưng' },
              ]}
            />
          </Form.Item>
          <MembersFormList
            withLinkedProfile
            withPositionPermission
            users={users}
            groupOptions={permissionGroupOptions}
            scopeTreeOptions={selectedScopeTreeOptions}
          />
        </>
      );
    }
    return (
      <>
        <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="linkedProfileUserId" label="Tài khoản liên kết (người phụ trách)">
          <LinkedProfileSelect users={users} nameField="managerName" />
        </Form.Item>
        <Form.Item name="managerName" hidden>
          <Input />
        </Form.Item>
        <PositionPermissionFields
          namePath="positionPermission"
          groupOptions={permissionGroupOptions}
          scopeTreeOptions={selectedScopeTreeOptions}
        />
        <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
          <Select
            options={[
              { value: EntityStatus.ACTIVE, label: 'Hoạt động' },
              { value: EntityStatus.INACTIVE, label: 'Ngưng' },
            ]}
          />
        </Form.Item>
        <Form.Item name="additionalInfo" label="Thông tin thêm">
          <Input.TextArea rows={3} />
        </Form.Item>
        <MembersFormList
          withLinkedProfile
          withPositionPermission
          users={users}
          groupOptions={permissionGroupOptions}
          scopeTreeOptions={selectedScopeTreeOptions}
        />
      </>
    );
  };

  const renderViewPanel = () => {
    if (!selected) return null;

    if (selected.member) {
      const m = selected.member;
      return (
        <div data-testid="unit-member-detail">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Chức vụ">{m.position}</Descriptions.Item>
            <Descriptions.Item label="Mã vị trí">
              {displayText(m.positionCode)}
            </Descriptions.Item>
            <Descriptions.Item label="Tên nhân viên">
              <Typography.Text strong>{m.memberName}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Đơn vị">{selected.data.name}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {linkedUserLabel(m.linkedProfileUserId, m.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{displayText(m.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(m.email)}</Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(m.additionalInfo)}</Descriptions.Item>
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(m.positionPermission)}
            </Descriptions.Item>
          </Descriptions>
        </div>
      );
    }

    const d = selected.data;
    if (selected.type === OrgNodeType.ORGANIZATION) {
      return (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tên tổ chức">{d.name}</Descriptions.Item>
            <Descriptions.Item label="Người đại diện">{displayText(d.representativeName)}</Descriptions.Item>
            <Descriptions.Item label="Mã vị trí">{displayText(d.positionCode)}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {linkedUserLabel(d.linkedProfileUserId, d.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(d.positionPermission)}
            </Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(d.additionalInfo)}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Danh sách thành viên
          </Typography.Title>
          <MembersViewList members={d.members} withLinkedProfile />
        </>
      );
    }
    if (selected.type === OrgNodeType.COMPANY) {
      return (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tên công ty">{d.name}</Descriptions.Item>
            <Descriptions.Item label="Mã số thuế">{displayText(d.taxId)}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">{displayText(d.address)}</Descriptions.Item>
            <Descriptions.Item label="Người đại diện">{displayText(d.representativeName)}</Descriptions.Item>
            <Descriptions.Item label="Mã vị trí">{displayText(d.positionCode)}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {linkedUserLabel(d.linkedProfileUserId, d.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(d.positionPermission)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{displayText(d.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(d.email)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái hoạt động">{statusTag(d.status)}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Danh sách thành viên
          </Typography.Title>
          <MembersViewList members={d.members} withLinkedProfile />
        </>
      );
    }
    return (
      <>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Tên đơn vị">{d.name}</Descriptions.Item>
          <Descriptions.Item label="Người phụ trách">{displayManagerName(d.managerName)}</Descriptions.Item>
          <Descriptions.Item label="Mã vị trí">{displayText(d.positionCode)}</Descriptions.Item>
          <Descriptions.Item label="Hồ sơ liên kết">
            {linkedUserLabel(d.linkedProfileUserId, d.linkedProfileName)}
          </Descriptions.Item>
          <Descriptions.Item label="Phân quyền vị trí">
            {formatPositionPermissionSummary(d.positionPermission)}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">{statusTag(d.status)}</Descriptions.Item>
          <Descriptions.Item label="Thông tin thêm">{displayText(d.additionalInfo)}</Descriptions.Item>
        </Descriptions>
        {(d.members?.length ?? 0) > 0 && (
          <>
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Danh sách chức vụ / nhân viên
            </Typography.Title>
            <EmployeesViewList members={d.members} />
          </>
        )}
      </>
    );
  };

  const panelTitle = () => {
    if (!selected) {
      return (
        <Space>
          <ApartmentOutlined />
          Tổ chức
        </Space>
      );
    }
    if (selected.member) {
      return (
        <Space size={8} align="center" wrap>
          <UserOutlined />
          <span>Chi tiết chức vụ</span>
          {renderReorderButtons()}
        </Space>
      );
    }
    const icon =
      selected.type === OrgNodeType.ORGANIZATION ? (
        <ApartmentOutlined />
      ) : selected.type === OrgNodeType.COMPANY ? (
        <BankOutlined />
      ) : (
        <ClusterOutlined />
      );
    return (
      <Space size={8} align="center" wrap>
        {icon}
        <span>{selected.type === OrgNodeType.ORGANIZATION ? 'Tổ chức' : 'Chi tiết'}</span>
        {renderReorderButtons()}
      </Space>
    );
  };

  return (
    <Card
      size="small"
      style={
        isDesktopLayout
          ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
          : undefined
      }
      styles={
        isDesktopLayout
          ? { body: { flex: 1, minHeight: 0, overflowY: 'auto' } }
          : undefined
      }
      title={panelTitle()}
      extra={renderPanelExtra()}
    >
      {selected ? (
        isEditing ? (
          <Form form={form} layout="vertical" onFinish={onSave}>
            {renderEditForm()}
            <Space style={{ width: '100%', marginTop: 16 }}>
              <Button type="primary" htmlType="submit">
                Lưu
              </Button>
              <Button onClick={onCancelEdit}>Hủy</Button>
            </Space>
          </Form>
        ) : (
          renderViewPanel()
        )
      ) : treeData ? (
        <Space direction="vertical">
          <Typography.Text>
            <strong>{treeData.name}</strong>
          </Typography.Text>
          {treeData.representativeName && (
            <Typography.Text type="secondary">
              Người đại diện: {treeData.representativeName}
            </Typography.Text>
          )}
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Chọn tổ chức, công ty hoặc đơn vị trên cây để xem/chỉnh sửa.
          </Typography.Paragraph>
        </Space>
      ) : null}
    </Card>
  );
}
