'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  meta,
  onPageChange,
  loading,
  onRowClick,
  emptyMessage = '暫無資料',
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                    col.width,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    載入中...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-border/50 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/30',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-foreground">
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            顯示 {(meta.page - 1) * meta.perPage + 1}–{Math.min(meta.page * meta.perPage, meta.total)} / 共 {meta.total} 筆
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={meta.page === 1} onClick={() => onPageChange?.(1)}>
              <ChevronsLeft size={16} />
            </Button>
            <Button variant="ghost" size="icon" disabled={meta.page === 1} onClick={() => onPageChange?.(meta.page - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <span className="px-3 py-1.5 rounded-md bg-muted/50 text-foreground text-xs">
              {meta.page} / {meta.totalPages}
            </span>
            <Button variant="ghost" size="icon" disabled={meta.page === meta.totalPages} onClick={() => onPageChange?.(meta.page + 1)}>
              <ChevronRight size={16} />
            </Button>
            <Button variant="ghost" size="icon" disabled={meta.page === meta.totalPages} onClick={() => onPageChange?.(meta.totalPages)}>
              <ChevronsRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
