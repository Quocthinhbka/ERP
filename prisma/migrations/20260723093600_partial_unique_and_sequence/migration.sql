-- Sequence sinh mã vị trí VT-xxxxx (không thuộc datamodel Prisma)
CREATE SEQUENCE IF NOT EXISTS org_position_code_seq;

-- Sequence sinh mã hồ sơ nhân sự / mã tài khoản HS-xxxxx (không thuộc datamodel Prisma)
CREATE SEQUENCE IF NOT EXISTS employee_profile_code_seq;

-- Partial unique cho danh tính hồ sơ: chỉ áp dụng khi chưa soft-delete.
-- Cho phép tái sử dụng SĐT/email/CCCD sau khi hồ sơ bị khoá/xoá mềm.
CREATE UNIQUE INDEX "employee_profiles_phone_active_key"
  ON "employee_profiles" ("phone")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "employee_profiles_email_active_key"
  ON "employee_profiles" ("email")
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL;

CREATE UNIQUE INDEX "employee_profiles_identity_number_active_key"
  ON "employee_profiles" ("identity_number")
  WHERE "deleted_at" IS NULL AND "identity_number" IS NOT NULL;

-- Mỗi cột built-in (storage_key) chỉ được map bởi tối đa một field def.
CREATE UNIQUE INDEX "employee_profile_field_defs_storage_key_key"
  ON "employee_profile_field_defs" ("storage_key")
  WHERE "storage_key" IS NOT NULL;

-- Mỗi hồ sơ chỉ có tối đa một yêu cầu chỉnh sửa đang chờ duyệt.
CREATE UNIQUE INDEX "employee_profile_one_pending_edit_request"
  ON "employee_profile_edit_requests" ("employee_profile_id")
  WHERE "status" = 'PENDING';
