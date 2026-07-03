import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import type { PaginationMeta } from '@shared/types/api';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-1">
      <p className="text-xs text-muted-foreground">
        {meta.total === 0 ? 'No results' : `${from}–${to} of ${meta.total}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!meta.hasPrev}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 text-xs font-medium text-muted-foreground">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
