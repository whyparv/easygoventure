import { useMemo, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { useLeads } from '@shared/queries/leads.queries';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';

/**
 * Agency name field with type-ahead suggestions drawn from existing leads'
 * company names. Free text is always allowed — selecting a suggestion just fills
 * the input; a brand-new agency name is kept as typed.
 */
export function AgencyAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useDebouncedValue(value.trim(), 250);

  // Reuse the existing leads search endpoint (matches company name too).
  const { data } = useLeads({ search: debounced || undefined, limit: 20 });

  const suggestions = useMemo(() => {
    const q = debounced.toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const lead of data?.items ?? []) {
      const name = lead.companyName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      if (q && !key.includes(q)) continue;
      if (key === value.trim().toLowerCase()) continue; // don't suggest the exact current value
      seen.add(key);
      out.push(name);
      if (out.length >= 6) break;
    }
    return out;
  }, [data, debounced, value]);

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a suggestion click registers before the list unmounts.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {showList && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                onMouseDown={(e) => {
                  // onMouseDown fires before input blur — commit the selection here.
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  onChange(s);
                  setOpen(false);
                }}
              >
                <Building2 className="size-3.5 text-muted-foreground" />
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
