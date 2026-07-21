import type { ReactNode } from 'react';
import { Form, Typography } from 'antd';

export type FieldMeta = {
  label: string;
  guide: string;
  hint?: string;
};

export const EMPLOYEE_FIELDS = {
  fullName: { label: 'Họ và tên', guide: 'Nhập đầy đủ họ tên theo CCCD.', hint: 'NGUYỄN VĂN A' },
  gender: { label: 'Giới tính', guide: 'Nam / Nữ / Khác.' },
  birthDate: { label: 'Ngày sinh', guide: 'Chọn đúng ngày sinh theo giấy tờ.' },
  birthPlace: { label: 'Nơi sinh', guide: 'Ghi theo giấy khai sinh.', hint: 'TP Hồ Chí Minh' },
  placeOfOrigin: { label: 'Nguyên quán', guide: 'Theo CCCD hoặc khai sinh.', hint: 'Hải Dương' },
  permanentAddress: { label: 'Hộ khẩu thường trú', guide: 'Địa chỉ đầy đủ.', hint: 'Số nhà, đường, phường/xã...' },
  currentAddress: { label: 'Chỗ ở hiện nay', guide: 'Địa chỉ hiện tại.', hint: 'Số nhà, đường, phường/xã...' },
  phone: { label: 'Điện thoại', guide: 'Chỉ nhập số, 10-11 chữ số.', hint: '0912345678' },
  email: { label: 'Email', guide: 'Email đang sử dụng.', hint: 'abc@gmail.com' },
  ethnicity: { label: 'Dân tộc', guide: 'Chọn theo danh mục dân tộc Việt Nam.' },
  religion: { label: 'Tôn giáo', guide: 'Có thể để trống nếu không có.' },
  identityNumber: { label: 'CCCD/CMND', guide: 'Nhập 12 số CCCD.', hint: '079123456789' },
  identityIssuedDate: { label: 'Ngày cấp', guide: 'Theo CCCD.' },
  identityIssuedPlace: { label: 'Nơi cấp', guide: 'Theo CCCD.', hint: 'Cục CSQLHC về TTXH' },
  educationLevel: { label: 'Trình độ văn hóa', guide: 'Chọn đúng trình độ hiện có.' },
  youthUnionAdmissionDate: { label: 'Ngày kết nạp Đoàn', guide: 'Để trống nếu chưa kết nạp.' },
  youthUnionAdmissionPlace: { label: 'Nơi kết nạp Đoàn', guide: 'Đơn vị hoặc trường kết nạp.' },
  partyAdmissionDate: { label: 'Ngày kết nạp Đảng', guide: 'Để trống nếu chưa vào Đảng.' },
  partyAdmissionPlace: { label: 'Nơi kết nạp Đảng', guide: 'Chi bộ hoặc tổ chức kết nạp.' },
  rewardDiscipline: { label: 'Khen thưởng / Kỷ luật', guide: 'Có thể nhập nhiều dòng.' },
  strengths: { label: 'Sở trường', guide: 'Mô tả kỹ năng nổi bật.' },
  status: { label: 'Trạng thái hồ sơ', guide: 'Đang hoạt động hoặc đã khóa.' },
} as const satisfies Record<string, FieldMeta>;

export const FAMILY_MEMBER_FIELDS = {
  relationship: { label: 'Quan hệ', guide: 'Bố, Mẹ, Anh, Chị, Em trai, Em gái hoặc Người giám hộ.' },
  fullName: { label: 'Họ tên', guide: 'Họ tên đầy đủ.', hint: 'NGUYỄN VĂN B' },
  birthYear: { label: 'Năm sinh', guide: 'Chỉ nhập năm.', hint: '1968' },
  occupation: { label: 'Nghề nghiệp hiện nay', guide: 'Nghề nghiệp hiện tại.' },
  workplace: { label: 'Cơ quan công tác', guide: 'Nếu đã nghỉ hưu có thể ghi Nghỉ hưu.' },
  currentResidence: { label: 'Chỗ ở hiện nay', guide: 'Địa chỉ hiện tại.' },
} as const satisfies Record<string, FieldMeta>;

export const EDUCATION_FIELDS = {
  fromMonth: { label: 'Từ tháng', guide: 'Tháng bắt đầu đào tạo.' },
  toMonth: { label: 'Đến tháng', guide: 'Tháng kết thúc đào tạo.' },
  institution: { label: 'Trường/Cơ sở đào tạo', guide: 'Tên đầy đủ của trường hoặc cơ sở.', hint: 'Đại học Kinh tế TP.HCM' },
  major: { label: 'Ngành học', guide: 'Tên ngành học hoặc chuyên ngành.' },
  trainingMode: { label: 'Hình thức đào tạo', guide: 'Chính quy, Tại chức, Liên thông, Văn bằng 2, Cao học hoặc Khác.' },
  degree: { label: 'Văn bằng/Chứng chỉ', guide: 'Văn bằng đạt được.', hint: 'Cử nhân' },
} as const satisfies Record<string, FieldMeta>;

export const WORK_FIELDS = {
  fromMonth: { label: 'Từ tháng', guide: 'Thời gian bắt đầu.' },
  toMonth: { label: 'Đến tháng', guide: 'Để trống nếu đang công tác.' },
  company: { label: 'Công ty/Cơ quan', guide: 'Tên doanh nghiệp hoặc cơ quan.' },
  department: { label: 'Đơn vị công tác', guide: 'Bộ phận làm việc.' },
  position: { label: 'Chức vụ', guide: 'Chức danh đảm nhiệm.' },
} as const satisfies Record<string, FieldMeta>;

export const SECTION_TITLES = {
  personal: 'I. Thông tin bản thân',
  family: 'II. Quan hệ gia đình',
  education: 'III. Tóm tắt quá trình đào tạo',
  work: 'IV. Tóm tắt quá trình công tác',
} as const;

/** Label + hướng dẫn dưới ô nhập (form sửa/thêm). */
export function GuidedFormItem({
  name,
  meta,
  required,
  children,
  getValueFromEvent,
  rules,
}: {
  name: string | (string | number)[];
  meta: FieldMeta;
  required?: boolean;
  children: ReactNode;
  getValueFromEvent?: (event: unknown) => unknown;
  rules?: Array<Record<string, unknown>>;
}) {
  return (
    <Form.Item
      name={name}
      label={meta.label}
      required={required}
      rules={
        rules ??
        (required
          ? [{ required: true, message: `Nhập ${meta.label.toLowerCase()}` }]
          : undefined)
      }
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {meta.guide}
        </Typography.Text>
      }
      getValueFromEvent={getValueFromEvent}
      style={{ marginBottom: 20 }}
    >
      {children}
    </Form.Item>
  );
}
