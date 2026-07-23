import { Descriptions, Empty, Tabs, Tag } from 'antd';
import {
  EmployeeProfileFieldDataType,
  EMPLOYMENT_STATUS_LABELS,
  WORK_PRESENCE_STATUS_LABELS,
  type EmployeeEmploymentStatus,
  type EmployeeWorkPresenceStatus,
} from '@erp/shared';
import {
  EDUCATION_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  profileStatusColor,
  profileStatusLabel,
} from './employee-catalogs';
import { EMPLOYEE_FIELDS } from './employee-fields';
import type { EmployeeProfileDetail } from './employee-types';
import type { ProfileLayoutTab } from './useEmployeeProfileFieldSettings';

function text(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function date(value?: string | null) {
  if (!value) return '—';
  return value.slice(0, 10);
}

function genderLabel(value?: string | null) {
  return GENDER_OPTIONS.find((item) => item.value === value)?.label ?? '—';
}
function religionLabel(value?: string | null) {
  return RELIGION_OPTIONS.find((item) => item.value === value)?.label ?? '—';
}
function educationLevelLabel(value?: string | null) {
  return EDUCATION_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? '—';
}

function formatBuiltin(key: string, profile: EmployeeProfileDetail): string {
  const raw = (profile as unknown as Record<string, unknown>)[key];
  if (key === 'gender') return genderLabel(profile.gender);
  if (key === 'religion') return religionLabel(profile.religion);
  if (key === 'educationLevel') return educationLevelLabel(profile.educationLevel);
  if (key === 'employmentStatus') {
    return profile.employmentStatus
      ? EMPLOYMENT_STATUS_LABELS[
          profile.employmentStatus as EmployeeEmploymentStatus
        ] ?? profile.employmentStatus
      : '—';
  }
  if (key === 'workPresenceStatus') {
    return profile.workPresenceStatus
      ? WORK_PRESENCE_STATUS_LABELS[
          profile.workPresenceStatus as EmployeeWorkPresenceStatus
        ] ?? profile.workPresenceStatus
      : '—';
  }
  if (key === 'managingCompanyId') {
    return profile.managingCompany?.name || '—';
  }
  if (
    key === 'birthDate' ||
    key === 'identityIssuedDate' ||
    key === 'youthUnionAdmissionDate' ||
    key === 'partyAdmissionDate'
  ) {
    return date(raw as string | null);
  }
  return text(raw as string | number | null);
}

type Props = {
  profile: EmployeeProfileDetail;
  tabs: ProfileLayoutTab[];
  showMeta?: boolean;
};

export function DynamicProfileDetailTabs({
  profile,
  tabs,
  showMeta = true,
}: Props) {
  const visibleTabs = tabs.filter((t) => t.visible);
  if (visibleTabs.length === 0) {
    return <Empty description="Chưa cấu hình tab hồ sơ" />;
  }

  return (
    <Tabs
      items={visibleTabs.map((tab) => ({
        key: tab.id,
        label: tab.name,
        children: (
          <Descriptions
            bordered
            column={1}
            size="middle"
            styles={{
              label: { width: '30%' },
              content: { width: '70%' },
            }}
          >
            {showMeta && tab.code === 'personal' ? (
              <>
                <Descriptions.Item label="Mã hồ sơ">
                  {profile.profileCode}
                </Descriptions.Item>
                <Descriptions.Item label={EMPLOYEE_FIELDS.status.label}>
                  <Tag color={profileStatusColor(profile.status)}>
                    {profileStatusLabel(profile.status)}
                  </Tag>
                </Descriptions.Item>
              </>
            ) : null}
            {tab.fields
              .filter(
                (f) =>
                  f.visible &&
                  f.dataType !== EmployeeProfileFieldDataType.SECTION,
              )
              .map((field) => {
                let value: string;
                if (field.storageKey) {
                  value = formatBuiltin(field.storageKey, profile);
                } else {
                  const raw = profile.customValues?.[field.code];
                  if (Array.isArray(raw)) value = raw.join(', ');
                  else if (typeof raw === 'boolean') value = raw ? 'Có' : 'Không';
                  else value = text(raw as string | number | null);
                }
                return (
                  <Descriptions.Item key={field.id} label={field.label}>
                    {value}
                  </Descriptions.Item>
                );
              })}
          </Descriptions>
        ),
      }))}
    />
  );
}
