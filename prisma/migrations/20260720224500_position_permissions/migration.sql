-- CreateEnum
CREATE TYPE "PositionHolderKind" AS ENUM ('ORGANIZATION_REP', 'COMPANY_REP', 'UNIT_MANAGER', 'UNIT_MEMBER');

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_permission_group_version_id_fkey";

-- AlterTable: remove permission group from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "permission_group_version_id";

-- AlterTable: OrganizationMember linked profile
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "linked_profile_user_id" TEXT;

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

-- CreateIndex
CREATE INDEX "position_permissions_holder_id_idx" ON "position_permissions"("holder_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_permissions_holder_kind_holder_id_key" ON "position_permissions"("holder_kind", "holder_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_permission_parent_scopes_position_permission_id_node_type_node_id_key" ON "position_permission_parent_scopes"("position_permission_id", "node_type", "node_id");

-- AddForeignKey
ALTER TABLE "position_permissions" ADD CONSTRAINT "position_permissions_permission_group_version_id_fkey" FOREIGN KEY ("permission_group_version_id") REFERENCES "permission_group_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_permission_parent_scopes" ADD CONSTRAINT "position_permission_parent_scopes_position_permission_id_fkey" FOREIGN KEY ("position_permission_id") REFERENCES "position_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_linked_profile_user_id_fkey" FOREIGN KEY ("linked_profile_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
