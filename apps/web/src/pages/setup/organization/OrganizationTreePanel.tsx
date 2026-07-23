import { Empty, Spin, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { OrgTreeNode } from '@erp/shared';
import { nodeKey, unitMemberKey, type SelectedNode } from './index';

type OrganizationTreePanelProps = {
  isDesktopLayout: boolean;
  loading: boolean;
  treeData: OrgTreeNode | null;
  antTreeData: DataNode[];
  expandedKeys: string[];
  selected: SelectedNode | null;
  onExpand: (keys: string[]) => void;
  onSelect: (_keys: React.Key[], info: { node: DataNode }) => void;
};

export function OrganizationTreePanel({
  isDesktopLayout,
  loading,
  treeData,
  antTreeData,
  expandedKeys,
  selected,
  onExpand,
  onSelect,
}: OrganizationTreePanelProps) {
  return (
    <div
      style={
        isDesktopLayout
          ? {
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'auto',
              overscrollBehavior: 'contain',
            }
          : undefined
      }
    >
      <Spin spinning={loading}>
        {treeData ? (
          <Tree
            data-testid="org-tree"
            showLine
            blockNode
            expandedKeys={expandedKeys}
            onExpand={(keys) => onExpand(keys.map(String))}
            selectedKeys={
              selected
                ? [
                    selected.member
                      ? unitMemberKey(selected.member.id)
                      : nodeKey(selected),
                  ]
                : []
            }
            treeData={antTreeData}
            onSelect={onSelect}
          />
        ) : (
          <Empty description="Chưa có dữ liệu tổ chức" />
        )}
      </Spin>
    </div>
  );
}
