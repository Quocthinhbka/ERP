import { Card, Checkbox, Form, Select, Typography } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import { scopeTreeNodeLabel } from './scope-utils';
import type { ScopeTreeOption } from './types';

export function PositionPermissionFields({
  namePath,
  groupOptions,
  scopeTreeOptions,
}: {
  namePath: NamePath;
  groupOptions: Array<{ value: string; label: string }>;
  scopeTreeOptions: ScopeTreeOption[];
}) {
  const versionName =
    Array.isArray(namePath) ? [...namePath, 'permissionGroupVersionId'] : [namePath, 'permissionGroupVersionId'];
  const includeSelfName =
    Array.isArray(namePath) ? [...namePath, 'includeSelf'] : [namePath, 'includeSelf'];
  const parentScopesName =
    Array.isArray(namePath) ? [...namePath, 'parentScopeKeys'] : [namePath, 'parentScopeKeys'];

  return (
    <Card size="small" title="Phân quyền vị trí" style={{ marginBottom: 12 }}>
      <Form.Item name={versionName} label="Nhóm quyền">
        <Select
          allowClear
          placeholder="Chọn nhóm quyền"
          options={groupOptions}
        />
      </Form.Item>
      <Form.Item name={includeSelfName} valuePropName="checked" initialValue={true}>
        <Checkbox>Chỉ cá nhân</Checkbox>
      </Form.Item>
      {scopeTreeOptions.length > 0 && (
        <Form.Item name={parentScopesName} label="Phạm vi tổ chức">
          <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scopeTreeOptions.map((option) => {
              const label = scopeTreeNodeLabel(option);
              const indent = option.depth * 20;
              if (option.selectable) {
                return (
                  <Checkbox
                    key={`${option.type}:${option.id}`}
                    value={`${option.type}:${option.id}`}
                    style={{ marginLeft: indent }}
                  >
                    {label}
                  </Checkbox>
                );
              }
              return (
                <Typography.Text
                  key={`${option.type}:${option.id}`}
                  type="secondary"
                  style={{ marginLeft: indent }}
                >
                  {label}
                </Typography.Text>
              );
            })}
          </Checkbox.Group>
        </Form.Item>
      )}
    </Card>
  );
}
