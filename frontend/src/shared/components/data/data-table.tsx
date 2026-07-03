import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { cn } from '@shared/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  activeRowId?: string;
  sort?: { by?: string; order: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  empty?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  skeletonRows = 8,
  onRowClick,
  activeRowId,
  sort,
  onSort,
  empty,
}: DataTableProps<T>) {
  const alignClass = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => {
                const active = sort?.by === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'sticky top-0 z-10 whitespace-nowrap bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                      alignClass(col.align),
                      col.headerClassName,
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        {col.header}
                        {active ? (
                          sort?.order === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-[70%]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = getRowId(row);
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        'group border-b border-border transition-colors last:border-0',
                        onRowClick && 'cursor-pointer hover:bg-muted/50',
                        activeRowId === id && 'bg-primary/[0.04]',
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-3 align-middle text-foreground',
                            alignClass(col.align),
                            col.className,
                          )}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && (empty ?? <EmptyState title="No records found" />)}
    </div>
  );
}
