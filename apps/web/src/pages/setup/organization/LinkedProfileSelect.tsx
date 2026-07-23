import { Descriptions, Form, Select, Space } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import { NO_ASSIGNEE_LABEL } from './constants';
import { userSelectOptions, workPresenceLabel } from './tree-utils';
import type { UserOption } from './types';

export function LinkedProfileSelect({
  users,
  nameField,
  phoneField,
  emailField,
  value,
  onChange,
}: {
  users: UserOption[];
  nameField?: NamePath;
  phoneField?: NamePath;
  emailField?: NamePath;
  value?: string;
  onChange?: (value: string | undefined) => void;
}) {
  const form = Form.useFormInstance();
  const linkedUsers = users.filter(
    (u) => Boolean(u.linkedEmployeeProfileId) && Boolean(u.linkedEmployeeProfile),
  );
  const selected = linkedUsers.find((u) => u.id === value);
  const profile = selected?.linkedEmployeeProfile;

  const applyProfile = (userId: string | undefined) => {
    onChange?.(userId);
    if (!userId) {
      if (nameField !== undefined) form.setFieldValue(nameField, NO_ASSIGNEE_LABEL);
      if (phoneField !== undefined) form.setFieldValue(phoneField, undefined);
      if (emailField !== undefined) form.setFieldValue(emailField, undefined);
      return;
    }
    const user = linkedUsers.find((u) => u.id === userId);
    const linked = user?.linkedEmployeeProfile;
    if (!user || !linked) return;
    if (nameField !== undefined) {
      form.setFieldValue(nameField, linked.fullName);
    }
    if (phoneField !== undefined) {
      form.setFieldValue(phoneField, linked.phone ?? undefined);
    }
    if (emailField !== undefined) {
      form.setFieldValue(emailField, linked.email ?? undefined);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Chọn tài khoản đã liên kết hồ sơ"
        options={userSelectOptions(linkedUsers)}
        value={value}
        onChange={applyProfile}
      />
      {profile ? (
        <Descriptions size="small" bordered column={1}>
          <Descriptions.Item label="Họ và tên">{profile.fullName}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">
            {profile.phone || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{profile.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái làm việc">
            {workPresenceLabel(profile.workPresenceStatus)}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Space>
  );
}
