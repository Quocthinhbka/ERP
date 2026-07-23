import { OrgNodeType, OrgTreeNode } from '@erp/shared';
import { nodeKey } from './tree-utils';
import type { ScopeTreeOption } from './types';

export function scopeTypeLabel(type: OrgNodeType | string) {
  if (type === OrgNodeType.ORGANIZATION || type === 'organization') return 'Tổ chức';
  if (type === OrgNodeType.COMPANY || type === 'company') return 'Công ty';
  return 'Đơn vị';
}

export function findPathToNode(
  root: OrgTreeNode,
  targetKey: string,
  path: OrgTreeNode[] = [],
): OrgTreeNode[] | null {
  const next = [...path, root];
  if (nodeKey(root) === targetKey) return next;
  for (const child of root.children) {
    const found = findPathToNode(child, targetKey, next);
    if (found) return found;
  }
  return null;
}

export function collectUnitDescendants(node: OrgTreeNode, depth: number): ScopeTreeOption[] {
  const options: ScopeTreeOption[] = [];
  for (const child of node.children) {
    if (child.type !== OrgNodeType.UNIT) continue;
    options.push({
      type: child.type,
      id: child.id,
      name: child.name,
      depth,
      selectable: false,
    });
    options.push(...collectUnitDescendants(child, depth + 1));
  }
  return options;
}

export function getScopeTreeOptions(tree: OrgTreeNode | null, targetKey: string): ScopeTreeOption[] {
  if (!tree) return [];
  const path = findPathToNode(tree, targetKey);
  if (!path || path.length === 0) return [];

  const options: ScopeTreeOption[] = [];
  const target = path[path.length - 1];

  path.slice(0, -1).forEach((node, index) => {
    options.push({
      type: node.type,
      id: node.id,
      name: node.name,
      depth: index,
      selectable: true,
    });
  });

  if (target.type === OrgNodeType.UNIT || target.type === OrgNodeType.COMPANY) {
    options.push({
      type: target.type,
      id: target.id,
      name: target.name,
      depth: path.length - 1,
      selectable: false,
      isCurrent: true,
    });
    options.push(...collectUnitDescendants(target, path.length));
  }

  return options;
}

export function scopeTreeNodeLabel(option: ScopeTreeOption) {
  const suffix = option.isCurrent
    ? option.type === OrgNodeType.COMPANY
      ? ' (công ty hiện tại)'
      : ' (đơn vị hiện tại)'
    : '';
  return `${scopeTypeLabel(option.type)}: ${option.name}${suffix}`;
}
