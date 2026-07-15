import { useEffect, useMemo, useState } from 'react';
import { Check, ConciergeBell, Layers, Plus } from 'lucide-react';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { Input, SearchInput } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { useServices } from '@shared/queries/services.queries';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { formatCurrency } from '@shared/lib/format';
import type { LeadServiceItem, Service } from '@shared/types/domain';

/**
 * Snapshot a catalog service at attach-time so later price changes never mutate a
 * quote. When picked to fulfil a generic requirement, the requirement is recorded
 * as the variantGroup so the requirement reads as fulfilled.
 */
function serviceToSnapshot(s: Service, requirement?: string): LeadServiceItem {
  const base = s.defaultSellPrice ?? s.basePrice;
  return {
    serviceId: s.id,
    serviceName: s.name,
    categoryCode: s.categoryCode,
    variantGroup: s.variantGroup ?? requirement ?? undefined,
    supplier: s.supplier,
    currency: s.currency,
    costPrice: s.costPrice,
    sellPrice: base,
    basePricePerUnit: base,
    pricingType: 'PRIVATE',
    snapshotDate: new Date().toISOString(),
  };
}

/**
 * Searchable catalog selector. Services are filtered to the lead's destination and
 * to active only. Selecting one snapshots it onto the lead. A free-text fallback
 * lets staff add a service not (yet) in the catalog.
 */
export function ServicePickerModal({
  open,
  onClose,
  destination,
  attached,
  onAdd,
  requirement,
}: {
  open: boolean;
  onClose: () => void;
  destination?: string;
  /** Names already attached (to show a check + prevent duplicates). */
  attached: string[];
  onAdd: (item: LeadServiceItem) => void;
  /** When opened to fulfil a generic requirement, pre-filter to its variants. */
  requirement?: string;
}) {
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const debounced = useDebouncedValue(search.trim(), 250);

  // When the modal opens for a requirement, pre-search its variants.
  useEffect(() => {
    if (open) setSearch(requirement ?? '');
  }, [open, requirement]);
  const attachedSet = useMemo(
    () => new Set(attached.map((n) => n.trim().toLowerCase())),
    [attached],
  );

  const { data, isLoading } = useServices(
    {
      page: 1,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'asc',
      isActive: 'true',
      ...(destination ? { destination } : {}),
      ...(debounced ? { search: debounced } : {}),
    },
    open,
  );
  const services = data?.items ?? [];

  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    onAdd({ serviceName: name, variantGroup: requirement, pricingType: 'PRIVATE', snapshotDate: new Date().toISOString() });
    setCustom('');
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={requirement ? `Choose a variant for “${requirement}”` : 'Add service'}
      description={
        requirement
          ? 'Pick the specific service the client is quoted.'
          : destination
            ? `Catalog services for ${destination}`
            : 'Catalog services'
      }
      className="max-w-lg"
    >
      <div className="space-y-3">
        <SearchInput
          placeholder="Search services…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : services.length === 0 ? (
            <EmptyState
              icon={ConciergeBell}
              title="No matching services"
              description="Add it as a custom service below, or create it in the Services catalog."
            />
          ) : (
            services.map((s) => {
              const isAttached = attachedSet.has(s.name.trim().toLowerCase());
              const price = s.defaultSellPrice ?? s.basePrice;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isAttached}
                  onClick={() => onAdd(serviceToSnapshot(s, requirement))}
                  className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ConciergeBell className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {s.categoryCode}
                      {s.supplier ? ` · ${s.supplier}` : ''}
                      {s.variantGroup && (
                        <span className="inline-flex items-center gap-0.5 text-primary/80">
                          <Layers className="size-3" /> {s.variantGroup}
                        </span>
                      )}
                    </p>
                  </div>
                  {price != null && (
                    <span className="shrink-0 text-sm font-medium text-foreground">
                      {formatCurrency(price, s.currency)}
                    </span>
                  )}
                  {isAttached ? (
                    <Check className="size-4 shrink-0 text-success" />
                  ) : (
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a custom service…"
          />
          <Button type="button" variant="secondary" disabled={!custom.trim()} onClick={addCustom}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <Badge tone="neutral" className="mr-1">
            Snapshot
          </Badge>
          Prices are copied onto the lead when attached — later catalog changes won’t affect this quote.
        </p>
      </div>
    </Modal>
  );
}
