import { Checkbox, Form, Input, InputNumber, Select, message } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  EDUCATION_LEVEL_OPTIONS,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
} from './employee-catalogs';
import { EmployeeProfileFieldDataType, EMPLOYMENT_STATUS_LABELS, WORK_PRESENCE_STATUS_LABELS } from '@erp/shared';
import type { ProfileLayoutField } from './useEmployeeProfileFieldSettings';
import { EMPLOYEE_FIELDS, GuidedFormItem, type FieldMeta } from './employee-fields';
import { api } from '../../lib/api';

const BUILTIN_OPTIONS: Record<string, { label: string; value: string }[]> = {
  gender: GENDER_OPTIONS,
  ethnicity: ETHNICITY_OPTIONS,
  religion: RELIGION_OPTIONS,
  educationLevel: EDUCATION_LEVEL_OPTIONS,
  employmentStatus: Object.entries(EMPLOYMENT_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  ),
  workPresenceStatus: Object.entries(WORK_PRESENCE_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  ),
};

function formName(field: ProfileLayoutField): string | (string | number)[] {
  if (field.storageKey) return field.storageKey;
  return ['customValues', field.code];
}

function metaFor(field: ProfileLayoutField): FieldMeta {
  const builtin = field.storageKey
    ? EMPLOYEE_FIELDS[field.storageKey as keyof typeof EMPLOYEE_FIELDS]
    : undefined;
  if (builtin) return builtin as FieldMeta;
  return {
    label: field.label,
    guide: field.label,
  };
}

function ManagingCompanySelect({
  disabled,
  onFocus,
  allowClear,
  currentCompany,
}: {
  disabled?: boolean;
  onFocus?: () => void;
  allowClear?: boolean;
  /** Công ty đã lưu trên hồ sơ — luôn có trong options để Select hiện đúng sau tạo/lưu. */
  currentCompany?: { id: string; name: string } | null;
}) {
  const form = Form.useFormInstance();
  const selectedId = Form.useWatch('managingCompanyId', form) as string | undefined;
  const [companies, setCompanies] = useState<
    Array<{ id: string; name: string; status?: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<Array<{ id: string; name: string; status?: string }>>(
        '/organization/companies',
      )
      .then(({ data }) => setCompanies(data))
      .catch(() => {
        setCompanies([]);
        message.error('Không tải được danh sách công ty');
      })
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => {
    const active = companies.filter(
      (company) => !company.status || company.status === 'ACTIVE',
    );
    const map = new Map(active.map((c) => [c.id, c.name]));

    const ensureOption = (id?: string | null, name?: string | null) => {
      if (!id) return;
      if (name?.trim()) {
        map.set(id, name.trim());
        return;
      }
      const fromList = companies.find((c) => c.id === id);
      if (fromList?.name) {
        map.set(id, fromList.name);
      }
    };

    ensureOption(currentCompany?.id, currentCompany?.name);
    ensureOption(selectedId, currentCompany?.id === selectedId ? currentCompany?.name : null);

    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [companies, currentCompany?.id, currentCompany?.name, selectedId]);

  return (
    <Select
      showSearch
      optionFilterProp="label"
      loading={loading}
      disabled={disabled}
      allowClear={allowClear}
      onFocus={onFocus}
      placeholder="Chọn công ty chủ quản"
      options={options}
      notFoundContent={loading ? 'Đang tải…' : 'Chưa có công ty đang hoạt động'}
    />
  );
}

type Props = {
  fields: ProfileLayoutField[];
  disabled?: boolean;
  onFocusField?: (meta: FieldMeta) => void;
  /** Đồng bộ với công ty đã khai báo khi tạo hồ sơ / đã lưu DB. */
  managingCompany?: { id: string; name: string } | null;
};

export function DynamicProfileFields({
  fields,
  disabled,
  onFocusField,
  managingCompany,
}: Props) {
  return (
    <>
      {fields
        .filter(
          (f) =>
            f.visible && f.dataType !== EmployeeProfileFieldDataType.SECTION,
        )
        .map((field) => {
          const meta = metaFor(field);
          const name = formName(field);
          const required = field.required;
          const focus = () => onFocusField?.(meta);
          const choices =
            field.options?.choices?.map((c) => ({
              value: c.value,
              label: c.label,
            })) ??
            (field.storageKey ? BUILTIN_OPTIONS[field.storageKey] : undefined);

          let control: ReactNode;
          if (field.storageKey === 'managingCompanyId') {
            control = (
              <ManagingCompanySelect
                key={`managing-company-${managingCompany?.id ?? 'none'}-${managingCompany?.name ?? ''}`}
                disabled={disabled}
                onFocus={focus}
                allowClear={!required}
                currentCompany={managingCompany}
              />
            );
          } else {
            switch (field.dataType) {
              case EmployeeProfileFieldDataType.TEXTAREA:
                control = (
                  <Input.TextArea rows={3} disabled={disabled} onFocus={focus} />
                );
                break;
              case EmployeeProfileFieldDataType.NUMBER:
                control = (
                  <InputNumber
                    style={{ width: '100%' }}
                    disabled={disabled}
                    onFocus={focus}
                  />
                );
                break;
              case EmployeeProfileFieldDataType.DATE:
                control = (
                  <Input type="date" disabled={disabled} onFocus={focus} />
                );
                break;
              case EmployeeProfileFieldDataType.BOOLEAN:
                control = <Checkbox disabled={disabled}>Có</Checkbox>;
                break;
              case EmployeeProfileFieldDataType.SELECT:
                control = (
                  <Select
                    allowClear={!required}
                    options={choices}
                    disabled={disabled}
                    onFocus={focus}
                    showSearch
                    optionFilterProp="label"
                  />
                );
                break;
              case EmployeeProfileFieldDataType.MULTISELECT:
                control = (
                  <Select
                    mode="multiple"
                    allowClear
                    options={choices}
                    disabled={disabled}
                    onFocus={focus}
                    optionFilterProp="label"
                  />
                );
                break;
              case EmployeeProfileFieldDataType.EMAIL:
                control = <Input disabled={disabled} onFocus={focus} />;
                break;
              case EmployeeProfileFieldDataType.PHONE:
                control = <Input disabled={disabled} onFocus={focus} />;
                break;
              default:
                control = <Input disabled={disabled} onFocus={focus} />;
            }
          }

          const extraRules = [];
          if (
            field.storageKey === 'phone' ||
            field.dataType === EmployeeProfileFieldDataType.PHONE
          ) {
            extraRules.push({
              pattern: /^\d{10,11}$/,
              message: 'Số điện thoại phải gồm 10-11 chữ số',
            });
          }
          if (field.storageKey === 'identityNumber') {
            extraRules.push({
              pattern: /^\d{12}$/,
              message: 'CCCD phải gồm 12 số',
            });
          }
          if (
            field.storageKey === 'email' ||
            field.dataType === EmployeeProfileFieldDataType.EMAIL
          ) {
            extraRules.push({ type: 'email' as const, message: 'Email không hợp lệ' });
          }

          if (field.dataType === EmployeeProfileFieldDataType.BOOLEAN) {
            return (
              <Form.Item
                key={field.id}
                name={name}
                label={field.label}
                valuePropName="checked"
                rules={
                  required
                    ? [{ required: true, message: `Chọn ${field.label}` }]
                    : []
                }
              >
                {control}
              </Form.Item>
            );
          }

          return (
            <GuidedFormItem
              key={field.id}
              name={name}
              meta={meta}
              required={required}
              hideGuide
              rules={extraRules}
            >
              {control}
            </GuidedFormItem>
          );
        })}
    </>
  );
}
