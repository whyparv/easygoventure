import { useMemo, useRef, useState } from 'react';
import { BedDouble, Star } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { useHotels } from '@shared/queries/hotels.queries';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import type { Hotel } from '@shared/types/ops-domain';

/**
 * Hotel-name field with type-ahead suggestions from the hotel reference catalog
 * (`GET /hotels?search=`). Selecting a hotel fills its name, star rating and
 * location; free text is always allowed for hotels not yet in the catalog.
 */
export function HotelAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (name: string) => void;
  onSelect: (hotel: Hotel) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useDebouncedValue(value.trim(), 250);

  // Only query once there's something to match, so we don't pull the whole catalog.
  const active = debounced.length >= 2;
  const { data } = useHotels(active ? { search: debounced, limit: 8 } : { limit: 8 }, active);

  const suggestions = useMemo(() => {
    if (debounced.length < 2) return [];
    const current = value.trim().toLowerCase();
    return (data?.items ?? []).filter((h) => h.name.toLowerCase() !== current).slice(0, 8);
  }, [data, debounced, value]);

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Hotel name'}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {showList && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md">
          {suggestions.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  onSelect(h);
                  setOpen(false);
                }}
              >
                <BedDouble className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {h.name}
                  {(h.area || h.city) && (
                    <span className="text-muted-foreground"> · {[h.area, h.city].filter(Boolean).join(', ')}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                  {h.starRating}
                  <Star className="size-3 fill-current" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
