export type NavNodeLike = {
  key: string;
  label: string;
  path?: string;
  children?: NavNodeLike[];
};

export type BreadcrumbSuffix = {
  label: string;
  path?: string;
};

export type BreadcrumbSegment = {
  key: string;
  label: string;
  path?: string;
  siblings: { key: string; label: string; path: string }[];
};

export function firstNavPath(node: NavNodeLike): string | undefined {
  if (node.path) return node.path;
  for (const child of node.children ?? []) {
    const found = firstNavPath(child);
    if (found) return found;
  }
  return undefined;
}

/** Tìm chuỗi menu khớp URL sâu nhất. */
export function findNavTrail(
  nodes: NavNodeLike[],
  pathname: string,
  ancestors: NavNodeLike[] = [],
): NavNodeLike[] | null {
  let best: NavNodeLike[] | null = null;
  let bestPathLen = -1;

  function visit(list: NavNodeLike[], chain: NavNodeLike[]) {
    for (const node of list) {
      const next = [...chain, node];
      if (node.path) {
        const matches =
          pathname === node.path || pathname.startsWith(`${node.path}/`);
        if (matches && node.path.length > bestPathLen) {
          best = next;
          bestPathLen = node.path.length;
        }
      }
      if (node.children?.length) {
        visit(node.children, next);
      }
    }
  }

  visit(nodes, ancestors);
  return best;
}

function siblingNavItems(parentList: NavNodeLike[]): BreadcrumbSegment['siblings'] {
  const items: BreadcrumbSegment['siblings'] = [];
  for (const node of parentList) {
    const path = firstNavPath(node);
    if (path) {
      items.push({ key: node.key, label: node.label, path });
    }
  }
  return items;
}

export function buildBreadcrumbSegments(
  navTree: NavNodeLike[],
  trail: NavNodeLike[],
  suffix: BreadcrumbSuffix[] = [],
): BreadcrumbSegment[] {
  const fromNav: BreadcrumbSegment[] = trail.map((node, index) => {
    const parentList = index === 0 ? navTree : (trail[index - 1].children ?? []);
    return {
      key: node.key,
      label: node.label,
      path: node.path ?? firstNavPath(node),
      siblings: siblingNavItems(parentList),
    };
  });

  const fromSuffix: BreadcrumbSegment[] = suffix.map((item, index) => ({
    key: `breadcrumb-suffix-${index}`,
    label: item.label,
    path: item.path,
    siblings: [],
  }));

  return [...fromNav, ...fromSuffix];
}
