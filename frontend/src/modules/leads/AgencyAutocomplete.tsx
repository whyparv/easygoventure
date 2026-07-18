import { useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { useAgencySearch } from '@shared/queries/agencies.queries';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import type { Agency } from '@shared/types/domain';

/**
 * Agency name field with type-ahead suggestions drawn from the /agencies API.
 * Free text is always allowed — selecting a suggestion fills the input and
 * fires onSelect; a brand-new agency name is kept as typed.
 */
export function AgencyAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (agency: Agency) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useDebouncedValue(value.trim(), 250);

  const { data } = useAgencySearch(debounced, debounced.length >= 1);

  const suggestions = data?.items ?? [];
  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {showList && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md">
          {suggestions.map((agency) => (
            <li key={agency.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  onChange(agency.name);
                  onSelect?.(agency);
                  setOpen(false);
                }}
              >
                <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{agency.name}</span>
                  {(agency.phone || agency.email) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[agency.phone, agency.email].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
