-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PositionHolderKind" AS ENUM ('ORGANIZATION_REP', 'COMPANY_REP', 'UNIT_MANAGER', 'UNIT_MEMBER');

-- CreateEnum
CREATE TYPE "EmployeeGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "phone" TEXT,
    "linked_employee_profile_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "permission_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_group_permissions" (
    "permission_group_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_group_permissions_pkey" PRIMARY KEY ("permission_group_id","permission_id")
);

-- CreateTable
CREATE TABLE "permission_group_versions" (
    "id" TEXT NOT NULL,
    "permission_group_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_group_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_group_version_permissions" (
    "version_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_group_version_permissions_pkey" PRIMARY KEY ("version_id","permission_id")
);

-- CreateTable
CREATE TABLE "position_permissions" (
    "id" TEXT NOT NULL,
    "holder_kind" "PositionHolderKind" NOT NULL,
    "holder_id" TEXT NOT NULL,
    "permission_group_version_id" TEXT NOT NULL,
    "include_self" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_permission_parent_scopes" (
    "id" TEXT NOT NULL,
    "position_permission_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_permission_parent_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "representative_name" TEXT,
    "linked_profile_user_id" TEXT,
    "additional_info" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "linked_profile_user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "additional_info" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "address" TEXT,
    "representative_name" TEXT,
    "linked_profile_user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_members" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "linked_profile_user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "additional_info" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_units" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "parent_unit_id" TEXT,
    "name" TEXT NOT NULL,
    "manager_name" TEXT,
    "linked_profile_user_id" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "additional_info" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_unit_members" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "linked_profile_user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "additional_info" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_unit_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" TEXT NOT NULL,
    "profile_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "gender" "EmployeeGender" NOT NULL,
    "birth_date" DATE NOT NULL,
    "birth_place" TEXT NOT NULL,
    "place_of_origin" TEXT NOT NULL,
    "permanent_address" TEXT NOT NULL,
    "current_address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ethnicity" TEXT NOT NULL,
    "religion" TEXT,
    "identity_number" TEXT NOT NULL,
    "identity_issued_date" DATE NOT NULL,
    "identity_issued_place" TEXT NOT NULL,
    "education_level" TEXT NOT NULL,
    "youth_union_admission_date" DATE,
    "youth_union_admission_place" TEXT,
    "party_admission_date" DATE,
    "party_admission_place" TEXT,
    "reward_discipline" TEXT,
    "strengths" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_family_members" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "birth_year" INTEGER,
    "current_residence" TEXT,
    "occupation" TEXT,
    "workplace" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_education_histories" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "from_month" DATE NOT NULL,
    "to_month" DATE NOT NULL,
    "institution" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "training_mode" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_education_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_work_histories" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "from_month" DATE NOT NULL,
    "to_month" DATE,
    "company" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_work_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_account_code_key" ON "users"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_linked_employee_profile_id_key" ON "users"("linked_employee_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_groups_code_key" ON "permission_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_group_versions_permission_group_id_version_numbe_key" ON "permission_group_versions"("permission_group_id", "version_number");

-- CreateIndex
CREATE INDEX "position_permissions_holder_id_idx" ON "position_permissions"("holder_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_permissions_holder_kind_holder_id_key" ON "position_permissions"("holder_kind", "holder_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_permission_parent_scopes_position_permission_id_no_key" ON "position_permission_parent_scopes"("position_permission_id", "node_type", "node_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_profile_code_key" ON "employee_profiles"("profile_code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_phone_key" ON "employee_profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_email_key" ON "employee_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_identity_number_key" ON "employee_profiles"("identity_number");

-- CreateIndex
CREATE INDEX "employee_profiles_full_name_idx" ON "employee_profiles"("full_name");

-- CreateIndex
CREATE INDEX "employee_profiles_phone_idx" ON "employee_profiles"("phone");

-- CreateIndex
CREATE INDEX "employee_profiles_email_idx" ON "employee_profiles"("email");

-- CreateIndex
CREATE INDEX "employee_profiles_identity_number_idx" ON "employee_profiles"("identity_number");

-- CreateIndex
CREATE INDEX "employee_profiles_status_idx" ON "employee_profiles"("status");

-- CreateIndex
CREATE INDEX "employee_family_members_employee_profile_id_idx" ON "employee_family_members"("employee_profile_id");

-- CreateIndex
CREATE INDEX "employee_education_histories_employee_profile_id_idx" ON "employee_education_histories"("employee_profile_id");

-- CreateIndex
CREATE INDEX "employee_work_histories_employee_profile_id_idx" ON "employee_work_histories"("employee_profile_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_linked_employee_profile_id_fkey" FOREIGN KEY ("linked_employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_permissions" ADD CONSTRAINT "permission_group_permissions_permission_group_id_fkey" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_permissions" ADD CONSTRAINT "permission_group_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_versions" ADD CONSTRAINT "permission_group_versions_permission_group_id_fkey" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_version_permissions" ADD CONSTRAINT "permission_group_version_permissions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "permission_group_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_group_version_permissions" ADD CONSTRAINT "permission_group_version_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_permissions" ADD CONSTRAINT "position_permissions_permission_group_version_id_fkey" FOREIGN KEY ("permission_group_version_id") REFERENCES "permission_group_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_permission_parent_scopes" ADD CONSTRAINT "position_permission_parent_scopes_position_permission_id_fkey" FOREIGN KEY ("position_permission_id") REFERENCES "position_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parent_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit_members" ADD CONSTRAINT "organization_unit_members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit_members" ADD CONSTRAINT "organization_unit_members_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_education_histories" ADD CONSTRAINT "employee_education_histories_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_work_histories" ADD CONSTRAINT "employee_work_histories_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sequence for HS-xxxxx profile codes
CREATE SEQUENCE IF NOT EXISTS "employee_profile_code_seq" START WITH 1 INCREMENT BY 1;
