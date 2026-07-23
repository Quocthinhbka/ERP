import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { BreadcrumbSuffix } from '../lib/nav-breadcrumb';

type PageBreadcrumbContextValue = {
  suffix: BreadcrumbSuffix[];
  setSuffix: (suffix: BreadcrumbSuffix[]) => void;
};

const PageBreadcrumbContext = createContext<PageBreadcrumbContextValue | null>(null);

export function PageBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [suffix, setSuffix] = useState<BreadcrumbSuffix[]>([]);
  const value = useMemo(() => ({ suffix, setSuffix }), [suffix]);

  return (
    <PageBreadcrumbContext.Provider value={value}>{children}</PageBreadcrumbContext.Provider>
  );
}

export function usePageBreadcrumbState() {
  const ctx = useContext(PageBreadcrumbContext);
  if (!ctx) {
    throw new Error('usePageBreadcrumbState must be used within PageBreadcrumbProvider');
  }
  return ctx.suffix;
}

/** Bổ sung phân cấp breadcrumb (trang chi tiết / form). */
export function usePageBreadcrumb(suffix: BreadcrumbSuffix[]) {
  const ctx = useContext(PageBreadcrumbContext);
  if (!ctx) {
    throw new Error('usePageBreadcrumb must be used within PageBreadcrumbProvider');
  }

  const { setSuffix } = ctx;

  useEffect(() => {
    setSuffix(suffix);
    return () => setSuffix([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suffix là mảng nhỏ, so sánh theo nội dung
  }, [setSuffix, JSON.stringify(suffix)]);
}
