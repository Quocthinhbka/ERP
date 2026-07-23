import { Form, Input, Modal } from 'antd';
import type { FormInstance } from 'antd/es/form';
import {
  LinkedProfileSelect,
  PositionPermissionFields,
  type ScopeTreeOption,
  type UserOption,
} from './index';

type OrganizationModalsProps = {
  employeeModalOpen: boolean;
  employeeForm: FormInstance;
  nameModal: 'company' | 'unit' | null;
  nameForm: FormInstance;
  users: UserOption[];
  permissionGroupOptions: Array<{ value: string; label: string }>;
  selectedScopeTreeOptions: ScopeTreeOption[];
  onCloseEmployeeModal: () => void;
  onAddEmployee: (values: Record<string, unknown>) => void;
  onCloseNameModal: () => void;
  onSubmitNameModal: (values: { name: string }) => void;
};

export function OrganizationModals({
  employeeModalOpen,
  employeeForm,
  nameModal,
  nameForm,
  users,
  permissionGroupOptions,
  selectedScopeTreeOptions,
  onCloseEmployeeModal,
  onAddEmployee,
  onCloseNameModal,
  onSubmitNameModal,
}: OrganizationModalsProps) {
  return (
    <>
      <Modal
        title="Thêm nhân viên"
        open={employeeModalOpen}
        onCancel={onCloseEmployeeModal}
        onOk={() => employeeForm.submit()}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={employeeForm} layout="vertical" onFinish={onAddEmployee}>
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
        </Form>
      </Modal>
      <Modal
        title={nameModal === 'company' ? 'Thêm công ty' : 'Thêm đơn vị'}
        open={nameModal !== null}
        onCancel={onCloseNameModal}
        onOk={() => nameForm.submit()}
        okText="Thêm"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={nameForm} layout="vertical" onFinish={onSubmitNameModal}>
          <Form.Item
            name="name"
            label={nameModal === 'company' ? 'Tên công ty' : 'Tên đơn vị'}
            rules={[
              {
                required: true,
                message:
                  nameModal === 'company' ? 'Nhập tên công ty' : 'Nhập tên đơn vị',
              },
            ]}
          >
            <Input
              autoFocus
              placeholder={
                nameModal === 'company' ? 'Nhập tên công ty' : 'Nhập tên đơn vị'
              }
              data-testid="org-name-input"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
