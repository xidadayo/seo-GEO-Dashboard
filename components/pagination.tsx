"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    pageCount,
    pageItems,
    pageSize,
    total: items.length,
    start: items.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end: Math.min(items.length, safePage * pageSize),
    setPage,
  };
}

export function PaginationControls({ pagination }: { pagination: ReturnType<typeof usePagination<unknown>> }) {
  if (pagination.total <= pagination.pageSize) return null;
  return <div className="flex flex-col gap-3 border-t border-[#edf1f2] px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
    <p>第 {pagination.start}-{pagination.end} 条，共 {pagination.total} 条</p>
    <div className="flex items-center gap-2">
      <Button variant="outline" disabled={pagination.page <= 1} onClick={() => pagination.setPage(pagination.page - 1)}>上一页</Button>
      <span className="min-w-16 text-center text-xs font-semibold text-slate-500">{pagination.page} / {pagination.pageCount}</span>
      <Button variant="outline" disabled={pagination.page >= pagination.pageCount} onClick={() => pagination.setPage(pagination.page + 1)}>下一页</Button>
    </div>
  </div>;
}
