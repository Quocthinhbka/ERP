import { Button, Card, Col, Input, Row, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Permissions } from '@erp/shared';
import { OrganizationIoActions } from './OrganizationIoActions';
import {
  ORG_PAGE_HEIGHT,
  OrganizationDetailPanel,
  OrganizationModals,
  OrganizationTreePanel,
  useOrganizationPage,
} from './organization';

export function OrganizationPage() {
  const page = useOrganizationPage();
  const {
    isDesktopLayout,
    hasPermission,
    treeData,
    loading,
    search,
    setSearch,
    expandedKeys,
    setExpandedKeys,
    selected,
    isEditing,
    setIsEditing,
    employeeModalOpen,
    nameModal,
    form,
    employeeForm,
    nameForm,
    users,
    permissionGroupOptions,
    selectedScopeTreeOptions,
    canUpdateSelected,
    antTreeData,
    siblingInfo,
    canReorderSelected,
    canDeleteMember,
    canDeleteUnit,
    canShowAddUnit,
    linkedUserLabel,
    loadTree,
    handleSelect,
    handleSave,
    handleCancelEdit,
    handleAddCompany,
    handleAddUnit,
    submitNameModal,
    handleDelete,
    handleDeleteMember,
    handleReorder,
    handleAddEmployee,
    openEmployeeModal,
    closeEmployeeModal,
    closeNameModal,
    expandAll,
    collapseAll,
  } = page;

  return (
    <div
      style={
        isDesktopLayout
          ? {
              height: ORG_PAGE_HEIGHT,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }
          : undefined
      }
    >
      <Card
        title="Tổ chức"
        style={
          isDesktopLayout
            ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
            : undefined
        }
        styles={
          isDesktopLayout
            ? { body: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }
            : undefined
        }
        extra={
          <Space wrap>
            <Input.Search
              placeholder="Tìm theo tên, người đại diện/phụ trách..."
              allowClear
              onSearch={(value) => {
                setSearch(value);
                loadTree(value || undefined);
              }}
              style={{ width: 280 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadTree(search || undefined, { preserveExpanded: true })}
            >
              Tải lại
            </Button>
            <Button onClick={expandAll}>Mở rộng</Button>
            <Button onClick={collapseAll}>Thu gọn</Button>
            <OrganizationIoActions
              canExport={hasPermission(Permissions.ORGANIZATION_VIEW)}
              canImport={hasPermission(Permissions.ORGANIZATION_MANAGE)}
              onApplied={() => {
                void loadTree(search || undefined, { preserveExpanded: true });
              }}
            />
          </Space>
        }
      >
        <Row
          gutter={16}
          style={isDesktopLayout ? { flex: 1, minHeight: 0, height: '100%' } : undefined}
        >
          <Col
            xs={24}
            lg={14}
            style={
              isDesktopLayout
                ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
                : undefined
            }
          >
            <OrganizationTreePanel
              isDesktopLayout={isDesktopLayout}
              loading={loading}
              treeData={treeData}
              antTreeData={antTreeData}
              expandedKeys={expandedKeys}
              selected={selected}
              onExpand={setExpandedKeys}
              onSelect={handleSelect}
            />
          </Col>
          <Col
            xs={24}
            lg={10}
            style={
              isDesktopLayout
                ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
                : undefined
            }
          >
            <OrganizationDetailPanel
              isDesktopLayout={isDesktopLayout}
              selected={selected}
              treeData={treeData}
              isEditing={isEditing}
              form={form}
              users={users}
              permissionGroupOptions={permissionGroupOptions}
              selectedScopeTreeOptions={selectedScopeTreeOptions}
              canUpdateSelected={canUpdateSelected}
              canReorderSelected={canReorderSelected}
              canDeleteMember={canDeleteMember}
              canDeleteUnit={canDeleteUnit}
              canShowAddUnit={canShowAddUnit}
              siblingInfo={siblingInfo}
              hasPermission={hasPermission}
              linkedUserLabel={linkedUserLabel}
              onStartEdit={() => setIsEditing(true)}
              onDelete={handleDelete}
              onDeleteMember={handleDeleteMember}
              onAddCompany={handleAddCompany}
              onAddUnit={handleAddUnit}
              onOpenEmployeeModal={openEmployeeModal}
              onSave={handleSave}
              onCancelEdit={handleCancelEdit}
              onReorder={handleReorder}
            />
          </Col>
        </Row>
      </Card>
      <OrganizationModals
        employeeModalOpen={employeeModalOpen}
        employeeForm={employeeForm}
        nameModal={nameModal}
        nameForm={nameForm}
        users={users}
        permissionGroupOptions={permissionGroupOptions}
        selectedScopeTreeOptions={selectedScopeTreeOptions}
        onCloseEmployeeModal={closeEmployeeModal}
        onAddEmployee={handleAddEmployee}
        onCloseNameModal={closeNameModal}
        onSubmitNameModal={submitNameModal}
      />
    </div>
  );
}
