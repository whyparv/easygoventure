import { useMemo, useState } from 'react';
import { Hotel as HotelIcon, LayoutGrid, MapPin, Search, Star, Table as TableIcon, WifiOff } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Select } from '@shared/components/ui/select';
import { SearchInput, Input } from '@shared/components/ui/input';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/ui/pagination';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { useHotels } from '@shared/queries/hotels.queries';
import { cn } from '@shared/utils/cn';
import type { Hotel } from '@shared/types/ops-domain';

const STAR_OPTIONS = [
  { label: 'All ratings', value: '' },
  { label: '5 star', value: '5' },
  { label: '4 star', value: '4' },
  { label: '3 star', value: '3' },
];

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="size-3.5 fill-current" />
      ))}
    </span>
  );
}

export default function HotelsPage() {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [star, setStar] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedCity = useDebouncedValue(city, 300);

  const params = useMemo(
    () => ({
      page,
      limit: view === 'grid' ? 24 : 20,
      sortBy: 'starRating',
      sortOrder: 'desc' as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(star ? { starRating: Number(star) } : {}),
      ...(debouncedCity ? { city: debouncedCity } : {}),
    }),
    [page, view, debouncedSearch, star, debouncedCity],
  );

  const { data, isLoading, isError, refetch } = useHotels(params);
  const hotels = data?.items ?? [];
  const usingFallback = hotels.some((h) => h.source === 'file');

  const resetPageAnd = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const columns: Column<Hotel>[] = [
    {
      key: 'name',
      header: 'Hotel',
      render: (h) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <HotelIcon className="size-4" />
          </div>
          <span className="font-medium text-foreground">{h.name}</span>
        </div>
      ),
    },
    { key: 'starRating', header: 'Rating', render: (h) => <Stars count={h.starRating} /> },
    { key: 'area', header: 'Area', render: (h) => h.area ?? '—' },
    { key: 'city', header: 'City', render: (h) => h.city },
    {
      key: 'country',
      header: 'Country',
      align: 'right',
      render: (h) => <span className="text-muted-foreground">{h.country}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hotel Catalog"
        description="Curated hotels the agency books into — searchable, filterable, always available."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid />
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setView('table')}
              aria-label="Table view"
            >
              <TableIcon />
            </Button>
          </div>
        }
      />

      {usingFallback && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <WifiOff className="size-4 shrink-0" />
          <span>Using local catalog — showing the bundled hotel list while the live database is unavailable.</span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchInput
            placeholder="Search hotels…"
            value={search}
            onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-40 pl-8"
              placeholder="City"
              value={city}
              onChange={(e) => resetPageAnd(() => setCity(e.target.value))}
            />
          </div>
          <Select
            className="w-36"
            options={STAR_OPTIONS}
            value={star}
            onChange={(e) => resetPageAnd(() => setStar(e.target.value))}
          />
        </div>
      </div>

      {isError ? (
        <Card className="p-6">
          <EmptyState
            icon={Search}
            title="Couldn't load hotels"
            description="The request failed. Check your connection and try again."
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        </Card>
      ) : isLoading ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <DataTable columns={columns} rows={[]} getRowId={(h) => h.id} loading skeletonRows={8} />
          </Card>
        )
      ) : hotels.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={HotelIcon}
            title="No hotels match"
            description="Try clearing filters or searching a different name or city."
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {hotels.map((h) => (
            <Card key={h.id} className={cn('flex flex-col gap-2 p-4 transition-shadow hover:shadow-md')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HotelIcon className="size-5" />
                </div>
                <Stars count={h.starRating} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{h.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {[h.area, h.city].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-1">
                <Badge tone="neutral">{h.category}</Badge>
                <span className="text-xs text-muted-foreground">{h.country}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <DataTable columns={columns} rows={hotels} getRowId={(h) => h.id} />
        </Card>
      )}

      {data && data.meta.total > 0 && <Pagination meta={data.meta} onPageChange={setPage} />}
    </div>
  );
}
