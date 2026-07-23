import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Divider, Space } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { FilterFilled } from '@ant-design/icons';

export type EnumFilterOption = {
  value: string;
  label: string;
};

type ExcelEnumFilterDropdownProps = FilterDropdownProps & {
  options: EnumFilterOption[];
  onApply: (values: string[]) => void;
};

export function ExcelEnumFilterDropdown({
  options,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
  onApply,
}: ExcelEnumFilterDropdownProps) {
  const [draft, setDraft] = useState<string[]>([]);

  useEffect(() => {
    setDraft((selectedKeys as string[]) ?? []);
  }, [selectedKeys]);

  const allValues = useMemo(() => options.map((option) => option.value), [options]);
  const allChecked = draft.length > 0 && draft.length === allValues.length;
  const indeterminate = draft.length > 0 && draft.length < allValues.length;

  return (
    <div style={{ padding: 8, width: 240 }} data-testid="excel-enum-filter-dropdown">
      <Checkbox
        indeterminate={indeterminate}
        checked={allChecked}
        onChange={(event) => {
          setDraft(event.target.checked ? allValues : []);
        }}
      >
        Chọn tất cả
      </Checkbox>
      <Divider style={{ margin: '8px 0' }} />
      <Checkbox.Group
        style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}
        value={draft}
        onChange={(values) => setDraft(values as string[])}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <Divider style={{ margin: '8px 0' }} />
      <Space>
        <Button
          type="primary"
          size="small"
          onClick={() => {
            const next = [...draft];
            setSelectedKeys(next);
            onApply(next);
            confirm({ closeDropdown: true });
          }}
        >
          OK
        </Button>
        <Button
          size="small"
          onClick={() => {
            setDraft([]);
            setSelectedKeys([]);
            onApply([]);
            clearFilters?.();
            confirm({ closeDropdown: true });
          }}
        >
          Huỷ lọc
        </Button>
      </Space>
    </div>
  );
}

export function excelEnumFilterIcon(active: boolean) {
  return <FilterFilled style={{ color: active ? '#1677ff' : undefined }} />;
}

export function excelEnumColumnFilter<T>(config: {
  options: EnumFilterOption[];
  filteredValue: string[];
  onApply: (values: string[]) => void;
}) {
  const active = config.filteredValue.length > 0;
  return {
    filteredValue: active ? config.filteredValue : null,
    filterIcon: excelEnumFilterIcon(active),
    filterDropdown: (props: FilterDropdownProps) => (
      <ExcelEnumFilterDropdown
        {...props}
        options={config.options}
        onApply={config.onApply}
      />
    ),
  } satisfies Pick<
    import('antd/es/table/interface').ColumnType<T>,
    'filteredValue' | 'filterIcon' | 'filterDropdown'
  >;
}
