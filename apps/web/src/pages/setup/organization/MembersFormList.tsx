import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import { NO_ASSIGNEE_LABEL } from './constants';
import { LinkedProfileSelect } from './LinkedProfileSelect';
import { PositionPermissionFields } from './PositionPermissionFields';
import type { ScopeTreeOption, UserOption } from './types';

export function MembersFormList({
  withLinkedProfile,
  withPositionPermission,
  users,
  groupOptions,
  scopeTreeOptions,
}: {
  withLinkedProfile?: boolean;
  withPositionPermission?: boolean;
  users: UserOption[];
  groupOptions?: Array<{ value: string; label: string }>;
  scopeTreeOptions?: ScopeTreeOption[];
}) {
  return (
    <Form.List name="members">
      {(fields, { add, remove }) => (
        <>
          <Typography.Text strong>Danh sách thành viên</Typography.Text>
          {fields.map(({ key, name, ...restField }) => (
            <Card key={key} size="small" style={{ marginTop: 8 }}>
              <Form.Item {...restField} name={[name, 'id']} hidden>
                <Input />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[name, 'position']}
                    label="Chức vụ"
                    rules={[{ required: true, message: 'Nhập chức vụ' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                {withLinkedProfile ? (
                  <>
                    <Col span={24}>
                      <Form.Item
                        {...restField}
                        name={[name, 'linkedProfileUserId']}
                        label="Tài khoản liên kết"
                      >
                        <LinkedProfileSelect
                          users={users}
                          nameField={['members', name, 'memberName']}
                          phoneField={['members', name, 'phone']}
                          emailField={['members', name, 'email']}
                        />
                      </Form.Item>
                    </Col>
                    <Form.Item {...restField} name={[name, 'memberName']} hidden initialValue={NO_ASSIGNEE_LABEL}>
                      <Input />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'phone']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'email']} hidden>
                      <Input />
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <Col span={12}>
                      <Form.Item
                        {...restField}
                        name={[name, 'memberName']}
                        label="Tên thành viên"
                        rules={[{ required: true, message: 'Nhập tên' }]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item {...restField} name={[name, 'phone']} label="Số điện thoại">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item {...restField} name={[name, 'email']} label="Email">
                        <Input />
                      </Form.Item>
                    </Col>
                  </>
                )}
                <Col span={24}>
                  <Form.Item {...restField} name={[name, 'additionalInfo']} label="Thông tin thêm">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
                {withPositionPermission && groupOptions && (
                  <Col span={24}>
                    <PositionPermissionFields
                      namePath={[name, 'positionPermission']}
                      groupOptions={groupOptions}
                      scopeTreeOptions={scopeTreeOptions ?? []}
                    />
                  </Col>
                )}
                <Col span={24}>
                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                    Xóa thành viên
                  </Button>
                </Col>
              </Row>
            </Card>
          ))}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => add({ memberName: NO_ASSIGNEE_LABEL })}
            style={{ marginTop: 8 }}
          >
            Thêm thành viên
          </Button>
        </>
      )}
    </Form.List>
  );
}
