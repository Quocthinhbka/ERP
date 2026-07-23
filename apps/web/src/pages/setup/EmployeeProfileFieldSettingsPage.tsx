import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputRef } from 'antd/es/input';
import {
  EmployeeProfileFieldDataType,
  Permissions,
  PROFILE_FIELD_DATA_TYPE_LABELS,
} from '@erp/shared';
import { useAuth } from '../../contexts/AuthContext';
import {
  type ProfileLayoutField,
  type ProfileLayoutTab,
  useEmployeeProfileLayout,
} from '../hr/useEmployeeProfileFieldSettings';
import { useEmployeeProfileLayoutMutations } from './useEmployeeProfileLayoutMutations';

const NEW_TAB_NAME = 'Đổi tên Tab';

type FieldFormValues = {
  label: string;
  dataType: EmployeeProfileFieldDataType;
  required?: boolean;
  visible?: boolean;
  tabIds?: string[];
  sectionKind?: 'family' | 'education' | 'work';
  choicesText?: string;
};

function choicesFromText(text?: string) {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split('|').map((s) => s.trim());
      return { value: value || line, label: label || value || line };
    });
}

export function EmployeeProfileFieldSettingsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(Permissions.SETUP_MANAGE);
  const { layout, loading } = useEmployeeProfileLayout();
  const {
    applyLayout,
    createTab: createTabMutation,
    renameTab: renameTabMutation,
    reorderTabs: reorderTabsMutation,
    deleteTab: deleteTabMutation,
    createField: createFieldMutation,
    updateField: updateFieldMutation,
    deleteField: deleteFieldMutation,
    detachField: detachFieldMutation,
    attachField: attachFieldMutation,
    reorderFields: reorderFieldsMutation,
  } = useEmployeeProfileLayoutMutations();
  const [activeTabId, setActiveTabId] = useState<string>();
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<InputRef>(null);
  const [fieldModal, setFieldModal] = useState<{
    mode: 'create' | 'edit';
    field?: ProfileLayoutField;
  } | null>(null);
  const [fieldForm] = Form.useForm<FieldFormValues>();
  const dataTypeWatch = Form.useWatch('dataType', fieldForm);

  const orderedTabs = useMemo(
    () => [...layout.tabs].sort((a, b) => a.sortOrder - b.sortOrder),
    [layout.tabs],
  );

  useEffect(() => {
    if (!activeTabId && orderedTabs[0]) {
      setActiveTabId(orderedTabs[0].id);
    }
  }, [activeTabId, orderedTabs]);

  useEffect(() => {
    if (!renamingTabId) return;
    const timer = window.setTimeout(() => {
      const input = renameInputRef.current?.input;
      if (!input) return;
      input.focus();
      // Chọn toàn bộ để gõ đè; caret nằm ở cuối vùng chọn.
      input.setSelectionRange(0, input.value.length);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [renamingTabId]);

  const activeTab: ProfileLayoutTab | undefined = useMemo(
    () => orderedTabs.find((t) => t.id === activeTabId),
    [orderedTabs, activeTabId],
  );

  const applyLayoutAndTab = (data: Parameters<typeof applyLayout>[0]) => {
    applyLayout(data);
    if (activeTabId && !data.tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(data.tabs[0]?.id);
    }
  };

  const createTab = async () => {
    if (!canManage) return;
    try {
      const data = await createTabMutation.mutateAsync(NEW_TAB_NAME);
      applyLayoutAndTab(data);
      const sorted = [...data.tabs].sort((a, b) => a.sortOrder - b.sortOrder);
      const created =
        sorted.find((t) => t.name === NEW_TAB_NAME && !t.isSystem) ??
        sorted[sorted.length - 1];
      if (created) {
        setActiveTabId(created.id);
        setRenameDraft(created.name);
        setRenamingTabId(created.id);
      }
      message.success('Đã thêm tab — hãy đổi tên');
    } catch {
      /* mutation onError */
    }
  };

  const commitRename = async () => {
    if (!renamingTabId) return;
    const name = renameDraft.trim();
    if (!name) {
      message.warning('Tên tab không được trống');
      return;
    }
    try {
      const data = await renameTabMutation.mutateAsync({ tabId: renamingTabId, name });
      applyLayoutAndTab(data);
      setRenamingTabId(null);
    } catch {
      /* mutation onError */
    }
  };

  const swapTabs = async (leftIndex: number) => {
    if (!canManage) return;
    const rightIndex = leftIndex + 1;
    if (rightIndex >= orderedTabs.length) return;
    const nextIds = orderedTabs.map((t) => t.id);
    const tmp = nextIds[leftIndex];
    nextIds[leftIndex] = nextIds[rightIndex];
    nextIds[rightIndex] = tmp;
    try {
      const data = await reorderTabsMutation.mutateAsync(nextIds);
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const deleteTab = async (tab: ProfileLayoutTab) => {
    try {
      const data = await deleteTabMutation.mutateAsync(tab.id);
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const openCreateField = () => {
    fieldForm.resetFields();
    fieldForm.setFieldsValue({
      dataType: EmployeeProfileFieldDataType.TEXT,
      visible: true,
      required: false,
      tabIds: activeTabId ? [activeTabId] : [],
    });
    setFieldModal({ mode: 'create' });
  };

  const openEditField = (field: ProfileLayoutField) => {
    fieldForm.setFieldsValue({
      label: field.label,
      dataType: field.dataType,
      visible: field.visible,
      required: field.required,
      tabIds: field.tabIds,
      sectionKind: field.options?.sectionKind,
      choicesText: field.options?.choices
        ?.map((c) => `${c.value}|${c.label}`)
        .join('\n'),
    });
    setFieldModal({ mode: 'edit', field });
  };

  const submitField = async (values: FieldFormValues) => {
    const options =
      values.dataType === EmployeeProfileFieldDataType.SECTION
        ? { sectionKind: values.sectionKind }
        : values.dataType === EmployeeProfileFieldDataType.SELECT ||
            values.dataType === EmployeeProfileFieldDataType.MULTISELECT
          ? { choices: choicesFromText(values.choicesText) }
          : undefined;

    try {
      if (fieldModal?.mode === 'create') {
        const data = await createFieldMutation.mutateAsync({
          label: values.label,
          dataType: values.dataType,
          required: values.required,
          visible: values.visible,
          tabIds: values.tabIds,
          options,
        });
        applyLayoutAndTab(data);
      } else if (fieldModal?.field) {
        const data = await updateFieldMutation.mutateAsync({
          fieldId: fieldModal.field.id,
          body: {
            label: values.label,
            dataType: fieldModal.field.isSystem ? undefined : values.dataType,
            required: values.required,
            visible: values.visible,
            tabIds: values.tabIds,
            options,
          },
        });
        applyLayoutAndTab(data);
      }
      setFieldModal(null);
    } catch {
      /* mutation onError */
    }
  };

  const detachFromTab = async (field: ProfileLayoutField) => {
    if (!activeTabId) return;
    try {
      const data = await detachFieldMutation.mutateAsync({
        tabId: activeTabId,
        fieldId: field.id,
      });
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const attachToTab = async (fieldDefId: string) => {
    if (!activeTabId) return;
    try {
      const data = await attachFieldMutation.mutateAsync({
        tabId: activeTabId,
        fieldDefId,
      });
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const moveSelectedField = async (index: number, direction: -1 | 1) => {
    if (!canManage || !activeTabId) return;
    const fields = activeTab?.fields ?? [];
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const nextIds = fields.map((f) => f.id);
    const tmp = nextIds[index];
    nextIds[index] = nextIds[target];
    nextIds[target] = tmp;
    try {
      const data = await reorderFieldsMutation.mutateAsync({
        tabId: activeTabId,
        fieldDefIds: nextIds,
      });
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const deleteField = async (field: ProfileLayoutField) => {
    try {
      const data = await deleteFieldMutation.mutateAsync(field.id);
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const toggleFieldFlag = async (
    field: ProfileLayoutField,
    patch: { visible?: boolean; required?: boolean },
  ) => {
    if (!canManage || field.locked) return;
    try {
      const data = await updateFieldMutation.mutateAsync({
        fieldId: field.id,
        body: patch,
      });
      applyLayoutAndTab(data);
    } catch {
      /* mutation onError */
    }
  };

  const selectedFields = activeTab?.fields ?? [];
  const selectedIds = new Set(selectedFields.map((f) => f.id));
  const availableFields = layout.fields.filter((f) => !selectedIds.has(f.id));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }} data-testid="profile-fields-settings-page">
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Sắp xếp tab, gắn trường vào từng tab. Form/Chi tiết hồ sơ hiển thị theo
        cấu hình này.
      </Typography.Paragraph>

      {/* Tab bar tùy chỉnh */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 8,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {orderedTabs.map((tab, index) => (
          <Space key={tab.id} size={4} align="center">
            {index > 0 && canManage ? (
              <Button
                type="text"
                size="small"
                icon={<SwapOutlined />}
                title="Hoán đổi vị trí với tab bên trái"
                onClick={() => void swapTabs(index - 1)}
              />
            ) : null}
            {renamingTabId === tab.id ? (
              <Input
                ref={renameInputRef}
                size="small"
                value={renameDraft}
                style={{ width: 160 }}
                onChange={(e) => setRenameDraft(e.target.value)}
                onPressEnter={() => void commitRename()}
                onBlur={() => void commitRename()}
              />
            ) : (
              <Button
                type={activeTabId === tab.id ? 'primary' : 'default'}
                size="small"
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => {
                  if (!canManage) return;
                  setRenameDraft(tab.name);
                  setRenamingTabId(tab.id);
                }}
              >
                {tab.name}
                {tab.isSystem ? (
                  <Tag style={{ marginLeft: 6 }} color="blue">
                    Hệ thống
                  </Tag>
                ) : null}
              </Button>
            )}
            {canManage && !tab.isSystem && renamingTabId !== tab.id ? (
              <Button
                type="text"
                size="small"
                danger
                icon={<CloseOutlined />}
                title="Xóa tab"
                onClick={() => void deleteTab(tab)}
              />
            ) : null}
          </Space>
        ))}
        {canManage ? (
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => void createTab()}
          >
            Thêm Tab
          </Button>
        ) : null}
      </div>

      {!activeTab ? (
        <Typography.Text type="secondary">Chọn hoặc thêm tab.</Typography.Text>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Vùng trên: trường đã chọn */}
          <div
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 12,
              background: '#fafafa',
              minHeight: 120,
            }}
          >
            <Space
              style={{
                width: '100%',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Typography.Text strong>
                Trường trên tab «{activeTab.name}»
              </Typography.Text>
              {canManage ? (
                <Button size="small" icon={<PlusOutlined />} onClick={openCreateField}>
                  Thêm trường mới
                </Button>
              ) : null}
            </Space>
            {loading ? (
              <Typography.Text type="secondary">Đang tải…</Typography.Text>
            ) : selectedFields.length === 0 ? (
              <Typography.Text type="secondary">
                Chưa có trường — chọn từ vùng dưới.
              </Typography.Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {selectedFields.map((field, index) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    canManage={canManage}
                    zone="selected"
                    canMoveUp={index > 0}
                    canMoveDown={index < selectedFields.length - 1}
                    onMoveUp={() => void moveSelectedField(index, -1)}
                    onMoveDown={() => void moveSelectedField(index, 1)}
                    onEdit={() => openEditField(field)}
                    onDetach={() => void detachFromTab(field)}
                    onToggle={toggleFieldFlag}
                  />
                ))}
              </Space>
            )}
          </div>

          {/* Vùng dưới: trường chưa gắn tab hiện tại */}
          <div
            style={{
              border: '1px dashed #bfbfbf',
              borderRadius: 8,
              padding: 12,
              minHeight: 120,
            }}
          >
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Thư viện trường (chưa gắn tab này)
            </Typography.Text>
            {availableFields.length === 0 ? (
              <Typography.Text type="secondary">
                Tất cả trường đã được gắn vào tab này.
              </Typography.Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {availableFields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    canManage={canManage}
                    zone="available"
                    onEdit={() => openEditField(field)}
                    onAttach={() => void attachToTab(field.id)}
                    onDelete={
                      !field.isSystem
                        ? () => void deleteField(field)
                        : undefined
                    }
                    onToggle={toggleFieldFlag}
                  />
                ))}
              </Space>
            )}
          </div>
        </Space>
      )}

      <Modal
        title={fieldModal?.mode === 'edit' ? 'Sửa trường' : 'Thêm trường'}
        open={!!fieldModal}
        onCancel={() => setFieldModal(null)}
        onOk={() => fieldForm.submit()}
        okText="Lưu"
        destroyOnClose
        width={560}
      >
        <Form form={fieldForm} layout="vertical" onFinish={submitField}>
          <Form.Item
            name="label"
            label="Tên trường"
            rules={[{ required: true, message: 'Nhập tên' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="dataType"
            label="Kiểu dữ liệu"
            rules={[{ required: true }]}
          >
            <Select
              disabled={fieldModal?.field?.isSystem}
              options={Object.values(EmployeeProfileFieldDataType).map(
                (value) => ({
                  value,
                  label: PROFILE_FIELD_DATA_TYPE_LABELS[value],
                }),
              )}
            />
          </Form.Item>
          {dataTypeWatch === EmployeeProfileFieldDataType.SECTION ? (
            <Form.Item
              name="sectionKind"
              label="Loại mục"
              rules={[{ required: true, message: 'Chọn loại mục' }]}
            >
              <Select
                options={[
                  { value: 'family', label: 'Gia đình' },
                  { value: 'education', label: 'Học vấn' },
                  { value: 'work', label: 'Công tác' },
                ]}
              />
            </Form.Item>
          ) : null}
          {dataTypeWatch === EmployeeProfileFieldDataType.SELECT ||
          dataTypeWatch === EmployeeProfileFieldDataType.MULTISELECT ? (
            <Form.Item
              name="choicesText"
              label="Lựa chọn (mỗi dòng: value|Nhãn)"
              rules={[{ required: true, message: 'Nhập ít nhất 1 lựa chọn' }]}
            >
              <Input.TextArea rows={4} placeholder="APPRENTICE|Đang học việc" />
            </Form.Item>
          ) : null}
          <Form.Item name="tabIds" label="Thuộc tab">
            <Select
              mode="multiple"
              options={layout.tabs.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="visible" valuePropName="checked">
            <Checkbox disabled={!!fieldModal?.field?.locked}>Hiển thị</Checkbox>
          </Form.Item>
          <Form.Item name="required" valuePropName="checked">
            <Checkbox disabled={!!fieldModal?.field?.locked}>Bắt buộc</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function FieldRow({
  field,
  canManage,
  zone,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onAttach,
  onDetach,
  onDelete,
  onToggle,
}: {
  field: ProfileLayoutField;
  canManage: boolean;
  zone: 'selected' | 'available';
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit: () => void;
  onAttach?: () => void;
  onDetach?: () => void;
  onDelete?: () => void;
  onToggle: (
    field: ProfileLayoutField,
    patch: { visible?: boolean; required?: boolean },
  ) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
      }}
    >
      {zone === 'selected' && canManage ? (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={!canMoveUp}
            title="Đưa lên"
            onClick={onMoveUp}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={!canMoveDown}
            title="Đưa xuống"
            onClick={onMoveDown}
          />
        </Space>
      ) : null}
      <div style={{ flex: 1, minWidth: 160 }}>
        <Space size={6} wrap>
          <Typography.Text>{field.label}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {PROFILE_FIELD_DATA_TYPE_LABELS[field.dataType] ?? field.dataType}
          </Typography.Text>
          {field.locked ? <Tag>Khóa</Tag> : null}
          {field.isSystem ? <Tag color="blue">Hệ thống</Tag> : null}
        </Space>
      </div>
      {zone === 'selected' ? (
        <>
          <Checkbox
            checked={field.required}
            disabled={!canManage || field.locked || !field.visible}
            onChange={(e) =>
              void onToggle(field, { required: e.target.checked })
            }
          >
            Bắt buộc
          </Checkbox>
          <Checkbox
            checked={field.visible}
            disabled={!canManage || field.locked}
            onChange={(e) =>
              void onToggle(field, {
                visible: e.target.checked,
                required: e.target.checked ? field.required : false,
              })
            }
          >
            Hiển thị
          </Checkbox>
        </>
      ) : null}
      {canManage ? (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={onEdit} />
          {zone === 'selected' && onDetach ? (
            <Button size="small" onClick={onDetach}>
              Bỏ khỏi tab
            </Button>
          ) : null}
          {zone === 'available' && onAttach ? (
            <Button size="small" type="primary" onClick={onAttach}>
              Chọn
            </Button>
          ) : null}
          {zone === 'available' && onDelete ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={onDelete}
            />
          ) : null}
        </Space>
      ) : null}
    </div>
  );
}
