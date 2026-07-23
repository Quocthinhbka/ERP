import { Collapse, Descriptions, Typography } from 'antd';
import type { OrgMember } from '@erp/shared';
import { formatPositionPermissionSummary } from './form-utils';
import { displayText } from './tree-utils';

export function EmployeesViewList({ members }: { members?: OrgMember[] }) {
  if (!members?.length) {
    return <Typography.Text type="secondary">Chưa có nhân viên</Typography.Text>;
  }
  return (
    <Collapse
      items={members.map((m) => ({
        key: m.id,
        label: `${m.position}: ${m.memberName}`,
        children: (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Chức vụ">{m.position}</Descriptions.Item>
            <Descriptions.Item label="Tên nhân viên">{m.memberName}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {displayText(m.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{displayText(m.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(m.email)}</Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(m.additionalInfo)}</Descriptions.Item>
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(m.positionPermission)}
            </Descriptions.Item>
          </Descriptions>
        ),
      }))}
    />
  );
}

export function MembersViewList({ members, withLinkedProfile }: { members?: OrgMember[]; withLinkedProfile?: boolean }) {
  if (!members?.length) {
    return <Typography.Text type="secondary">Chưa có thành viên</Typography.Text>;
  }
  return (
    <Collapse
      items={members.map((m) => ({
        key: m.id,
        label: `${m.position}: ${m.memberName}`,
        children: (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Chức vụ">{m.position}</Descriptions.Item>
            <Descriptions.Item label="Tên thành viên">{m.memberName}</Descriptions.Item>
            {withLinkedProfile && (
              <Descriptions.Item label="Hồ sơ liên kết">
                {displayText(m.linkedProfileName)}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Số điện thoại">{displayText(m.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(m.email)}</Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(m.additionalInfo)}</Descriptions.Item>
          </Descriptions>
        ),
      }))}
    />
  );
}
