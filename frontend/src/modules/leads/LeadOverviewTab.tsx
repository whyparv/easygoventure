import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  Lightbulb,
  MessageCircle,
  Plus,
  Save,
  Star,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { servicesService } from '@shared/services/services.service';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { useUpdateLead } from '@shared/mutations/leads.mutations';
import { useAuthStore } from '@shared/stores/auth.store';
import type { UpdateLeadInput } from '@shared/services/leads.service';
import type { Lead, LeadHotelOption, LeadServiceItem } from '@shared/types/domain';
import {
  DEFAULT_ROOM_OCCUPANCY,
  INTERNAL_CURRENCY,
  normalizeHotelOption,
  occupancyToMax,
  toInternalAed,
} from '@shared/lib/lead-pricing';
import { AgencyAutocomplete } from './AgencyAutocomplete';
import { HotelAutocomplete } from './HotelAutocomplete';
import { RoomTypeInput } from './RoomTypeInput';
import { ServicePickerModal } from './ServicePickerModal';
import { WhatsAppQuoteModal } from './WhatsAppQuoteModal';

const CURRENCIES = [INTERNAL_CURRENCY];

interface FormState {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  destination: string;
  travelDate: string;
  returnDate: string;
  adults: string;
  children: string;
  rooms: string;
  nights: string;
  serviceItems: LeadServiceItem[];
  hotelOptions: LeadHotelOption[];
  markup: string;
  currency: string;
  quoteValidityHours: string;
  preparedBy: string;
}

const num = (v?: number) => (v == null ? '' : String(v));
const dateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');

function toForm(lead: Lead): FormState {
  return {
    name: lead.name ?? '',
    companyName: lead.companyName ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    destination: lead.destination ?? '',
    travelDate: dateInput(lead.travelDate),
    returnDate: dateInput(lead.returnDate),
    adults: num(lead.adults),
    children: num(lead.children),
    rooms: num(lead.rooms),
    nights: num(lead.nights),
    // Prefer catalog snapshots; fall back to legacy string services for older leads.
    serviceItems:
      lead.serviceItems && lead.serviceItems.length > 0
        ? lead.serviceItems.map((s) => ({ ...s }))
        : (lead.services ?? []).map((name) => ({ serviceName: name })),
    hotelOptions: (lead.hotelOptions ?? []).map((h) => ({ ...h })),
    markup: num(lead.markup),
    currency: INTERNAL_CURRENCY,
    quoteValidityHours: lead.quoteValidityHours != null ? String(lead.quoteValidityHours) : '48',
    preparedBy: lead.preparedBy ?? '',
  };
}

const toNum = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * A generic requirement (e.g. "Airport Transfer") is fulfilled once a selected
 * service belongs to its variant group, or a variant whose name contains the
 * requirement is picked (e.g. "Private Airport Transfer"), or it matches exactly.
 */
function isRequirementFulfilled(requirement: string, items: LeadServiceItem[]): boolean {
  const req = requirement.trim().toLowerCase();
  return items.some((it) => {
    const group = it.variantGroup?.trim().toLowerCase();
    const name = it.serviceName.trim().toLowerCase();
    return group === req || name === req || name.includes(req);
  });
}

export function LeadOverviewTab({ lead }: { lead: Lead }) {
  const update = useUpdateLead();
  // Default "Prepared By" to the staff member's first name (not email).
  const currentUserName = useAuthStore((s) => {
    const u = s.user;
    if (!u) return undefined;
    return u.firstName?.trim() || u.email?.split('@')[0];
  });
  const [form, setForm] = useState<FormState>(() => toForm(lead));
  const [waOpen, setWaOpen] = useState(false);

  // Re-seed when a different lead is opened, or when the record refetches.
  useEffect(() => {
    setForm(toForm(lead));
  }, [lead]);

  // Default "Prepared By" to the logged-in staff member (still editable).
  useEffect(() => {
    if (!form.preparedBy && currentUserName) {
      setForm((f) => (f.preparedBy ? f : { ...f, preparedBy: currentUserName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserName]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pax = Math.max(1, (Number(form.adults) || 0) + (Number(form.children) || 0));
  const defaultNights = Math.max(1, Number(form.nights) || 1);
  const sourceCurrency = lead.currency ?? INTERNAL_CURRENCY;

  const patch: UpdateLeadInput = useMemo(
    () => ({
      name: form.name.trim(),
      companyName: form.companyName.trim() || undefined,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      destination: form.destination.trim() || undefined,
      travelDate: form.travelDate || undefined,
      returnDate: form.returnDate || undefined,
      adults: toNum(form.adults),
      children: toNum(form.children),
      rooms: toNum(form.rooms),
      nights: toNum(form.nights),
      serviceItems: form.serviceItems,
      // Keep the legacy string list in sync (back-compat + quote fallback).
      services: form.serviceItems.map((s) => s.serviceName),
      hotelOptions: form.hotelOptions.map((h) =>
        normalizeHotelOption(h, { pax, fallbackNights: defaultNights, fallbackCurrency: sourceCurrency }),
      ),
      markup: toNum(form.markup),
      currency: INTERNAL_CURRENCY,
      quoteValidityHours: toNum(form.quoteValidityHours),
      preparedBy: form.preparedBy.trim() || undefined,
    }),
    [defaultNights, form, pax, sourceCurrency],
  );

  // Live preview record: saved lead overlaid with the current (possibly unsaved) form.
  const previewLead: Lead = useMemo(
    () => ({
      ...lead,
      ...patch,
      preparedBy: patch.preparedBy || currentUserName,
    }),
    [lead, patch, currentUserName],
  );

  const save = () => update.mutate({ id: lead.id, input: patch });

  const requestedServices = lead.requestedServices ?? [];
  const requestedHotels = lead.requestedHotels ?? [];

  return (
    <div className="space-y-5 pb-2">
      {/* ── Client requirements (the working brief) ────────────────────── */}
      <ClientRequirementsCard lead={lead} />
      <OriginalInquiry raw={lead.rawInquiry} />

      {/* ── Agency information ─────────────────────────────────────────── */}
      <Section title="Agency Information">
        <Field label="Agency Name">
          <AgencyAutocomplete
            value={form.companyName}
            onChange={(v) => set('companyName', v)}
            placeholder="Travel Connect"
          />
        </Field>
        <Field label="Contact Person">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Chukwudi Emmanuel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Number">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+234…" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="optional" />
          </Field>
        </div>
      </Section>

      {/* ── Travel information ─────────────────────────────────────────── */}
      <Section title="Travel Information">
        <Field label="Destination">
          <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Dubai" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Travel Date">
            <Input type="date" value={form.travelDate} onChange={(e) => set('travelDate', e.target.value)} />
          </Field>
          <Field label="Return Date">
            <Input type="date" value={form.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Adults">
            <Input type="number" min={0} value={form.adults} onChange={(e) => set('adults', e.target.value)} />
          </Field>
          <Field label="Children">
            <Input type="number" min={0} value={form.children} onChange={(e) => set('children', e.target.value)} />
          </Field>
          <Field label="Rooms">
            <Input type="number" min={0} value={form.rooms} onChange={(e) => set('rooms', e.target.value)} />
          </Field>
          <Field label="Nights">
            <Input type="number" min={0} value={form.nights} onChange={(e) => set('nights', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* ── Services ───────────────────────────────────────────────────── */}
      <Section title="Services">
        <ServicesPicker
          value={form.serviceItems}
          onChange={(v) => set('serviceItems', v)}
          destination={form.destination}
          pax={pax}
          suggestions={requestedServices.filter((s) => !isRequirementFulfilled(s, form.serviceItems))}
        />
      </Section>

      {/* ── Hotel options ──────────────────────────────────────────────── */}
      <Section title="Hotel Options">
        <HotelOptionsEditor
          options={form.hotelOptions}
          currency={INTERNAL_CURRENCY}
          pax={pax}
          defaultNights={defaultNights}
          sourceCurrency={sourceCurrency}
          onChange={(v) => set('hotelOptions', v)}
          suggestions={requestedHotels.filter(
            (h) => !form.hotelOptions.some((o) => o.name.trim().toLowerCase() === h.trim().toLowerCase()),
          )}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Currency">
            <Select
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
              options={CURRENCIES.map((c) => ({ label: c, value: c }))}
            />
          </Field>
          <Field label="Markup">
            <Input type="number" min={0} value={form.markup} onChange={(e) => set('markup', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Validity (hrs)">
            <Input
              type="number"
              min={0}
              value={form.quoteValidityHours}
              onChange={(e) => set('quoteValidityHours', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Internal tracking ──────────────────────────────────────────── */}
      <Section title="Internal Tracking">
        <Field label="Prepared By (EasyGo Venture staff)">
          <Input
            value={form.preparedBy}
            onChange={(e) => set('preparedBy', e.target.value)}
            placeholder={currentUserName ?? 'Staff name'}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Signs the WhatsApp quote as “— Easy Go Venture Tourism (by {form.preparedBy || currentUserName || '…'})”.
        </p>
      </Section>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <Button className="flex-1" variant="secondary" loading={update.isPending} onClick={save}>
          <Save className="size-4" /> Save details
        </Button>
        <Button className="flex-1" onClick={() => setWaOpen(true)}>
          <MessageCircle className="size-4" /> Generate WhatsApp Message
        </Button>
      </div>

      <WhatsAppQuoteModal open={waOpen} onOpenChange={setWaOpen} lead={previewLead} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * Pre-suggests items the client requested that aren't selected yet. Clicking adds
 * one — it never auto-applies, so the agent stays in control.
 */
function SuggestionRow({
  label,
  items,
  onAdd,
}: {
  label: string;
  items: string[];
  onAdd: (item: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/[0.04] p-2.5">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
        <Lightbulb className="size-3.5" /> {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAdd(s)}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-card px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="size-3" /> {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The CLIENT REQUIREMENTS brief — the sales staff's working brief for the lead.
 * Renders the AI-authored note verbatim, or composes one from the requested
 * services/hotels when no note exists.
 */
function ClientRequirementsCard({ lead }: { lead: Lead }) {
  const note = lead.requirementsNote?.trim();
  const services = lead.requestedServices ?? [];
  const hotels = lead.requestedHotels ?? [];
  if (!note && services.length === 0 && hotels.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-primary/30 bg-primary/[0.04]">
      <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <ClipboardList className="size-4" /> Client Requirements
      </div>
      <div className="p-4">
        {note ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
            {note}
          </pre>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Requested services</p>
                <ul className="space-y-0.5 text-sm text-foreground">
                  {services.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {hotels.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Preferred hotels</p>
                <ul className="space-y-0.5 text-sm text-foreground">
                  {hotels.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Collapsible view of the exact inquiry text that was received. */
function OriginalInquiry({ raw }: { raw?: string }) {
  if (!raw?.trim()) return null;
  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        Original Inquiry
      </summary>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-t border-border px-4 py-3 font-sans text-sm leading-relaxed text-foreground">
        {raw}
      </pre>
    </details>
  );
}

/**
 * Editable service rows — each item shows pricing type (PRIVATE/SHARED), capacity,
 * base price, and auto-calculated per-person cost. "Add Service" opens the catalog
 * picker; "requested" suggestions are one-click adds.
 */
function ServicesPicker({
  value,
  onChange,
  destination,
  pax,
  suggestions = [],
}: {
  value: LeadServiceItem[];
  onChange: (v: LeadServiceItem[]) => void;
  destination?: string;
  pax: number;
  suggestions?: string[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [requirement, setRequirement] = useState<string | null>(null);

  const has = (name: string) =>
    value.some((s) => s.serviceName.trim().toLowerCase() === name.trim().toLowerCase());

  const add = (item: LeadServiceItem) => {
    if (has(item.serviceName)) return;
    onChange([...value, item]);
  };

  const updateAt = (i: number, patch: Partial<LeadServiceItem>) => {
    const updated = { ...value[i], ...patch, currency: INTERNAL_CURRENCY };
    // Auto-recalculate sellPrice when pricing inputs change
    const base =
      updated.basePricePerUnit != null
        ? Math.round(
            patch.basePricePerUnit != null
              ? updated.basePricePerUnit
              : toInternalAed(updated.basePricePerUnit, value[i].currency ?? INTERNAL_CURRENCY),
          )
        : undefined;
    if (base != null && base > 0) {
      updated.basePricePerUnit = base;
      if (updated.pricingType === 'SHARED') {
        const cap = updated.capacity ?? 1;
        const units = Math.ceil(pax / cap);
        updated.sellPrice = Math.round((units * base) / pax);
      } else {
        updated.sellPrice = base;
      }
    }
    onChange(value.map((v, idx) => (idx === i ? updated : v)));
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const openPicker = (req: string | null) => {
    setRequirement(req);
    setPickerOpen(true);
  };

  return (
    <div className="space-y-3">
      <SuggestionRow label="Requested by client — pick a variant" items={suggestions} onAdd={openPicker} />

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet. Add from the catalog to build the quote.</p>
      ) : (
        <div className="space-y-2.5">
          {value.map((svc, i) => (
            <ServiceItemRow
              key={`${svc.serviceName}-${i}`}
              item={svc}
              pax={pax}
              destination={destination}
              onUpdate={(patch) => updateAt(i, patch)}
              onRemove={() => removeAt(i)}
            />
          ))}
        </div>
      )}

      <Button type="button" variant="secondary" onClick={() => openPicker(null)}>
        <Plus className="size-4" /> Add Service
      </Button>

      <ServicePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        destination={destination}
        attached={value.map((s) => s.serviceName)}
        onAdd={add}
        requirement={requirement ?? undefined}
      />
    </div>
  );
}

function ServiceItemRow({
  item, pax, destination, onUpdate, onRemove,
}: {
  item: LeadServiceItem;
  pax: number;
  destination?: string;
  onUpdate: (patch: Partial<LeadServiceItem>) => void;
  onRemove: () => void;
}) {
  const pricingType = item.pricingType ?? 'PRIVATE';
  const capacity = item.capacity ?? 1;
  const currency = INTERNAL_CURRENCY;
  const base =
    item.basePricePerUnit != null
      ? Math.round(toInternalAed(item.basePricePerUnit, item.currency ?? INTERNAL_CURRENCY))
      : 0;
  const sellPrice =
    item.sellPrice != null
      ? Math.round(toInternalAed(item.sellPrice, item.currency ?? INTERNAL_CURRENCY))
      : undefined;
  let calculatedLabel = '';
  if (base > 0) {
    if (pricingType === 'SHARED') {
      const units = Math.ceil(pax / capacity);
      const perPerson = Math.round((units * base) / pax);
      calculatedLabel = `${units} unit(s) × ${currency} ${base} ÷ ${pax} pax = ${currency} ${perPerson}/pax`;
    } else {
      calculatedLabel = `${currency} ${base} × ${pax} pax = ${currency} ${base * pax} total`;
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
      {/* Name row */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ServiceInlineSearch
            value={item.serviceName}
            destination={destination}
            onValueChange={(v) => onUpdate({ serviceName: v })}
            onSelect={(s) => onUpdate({
              serviceName: s.name,
              basePricePerUnit:
                s.defaultSellPrice != null || s.basePrice != null
                  ? Math.round(toInternalAed((s.defaultSellPrice ?? s.basePrice)!, s.currency))
                  : undefined,
              currency: INTERNAL_CURRENCY,
              costPrice: s.costPrice != null ? Math.round(toInternalAed(s.costPrice, s.currency)) : undefined,
              sellPrice:
                s.defaultSellPrice != null || s.basePrice != null
                  ? Math.round(toInternalAed((s.defaultSellPrice ?? s.basePrice)!, s.currency))
                  : undefined,
            })}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-danger"
          aria-label="Remove service"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Config row: pricing type + capacity + base price + currency */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Pricing</label>
          <select
            value={pricingType}
            onChange={(e) => onUpdate({ pricingType: e.target.value as 'PRIVATE' | 'SHARED' })}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
          >
            <option value="PRIVATE">PRIVATE</option>
            <option value="SHARED">SHARED</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
            {pricingType === 'SHARED' ? 'Max pax/unit' : 'Base price'}
          </label>
          {pricingType === 'SHARED' ? (
            <Input
              type="number"
              min={1}
              value={capacity || ''}
              onChange={(e) => onUpdate({ capacity: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="4"
              className="h-8 text-xs"
            />
          ) : (
            <Input
              type="number"
              min={0}
              value={base || ''}
              onChange={(e) => onUpdate({ basePricePerUnit: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0"
              className="h-8 text-xs"
            />
          )}
        </div>

        {pricingType === 'SHARED' && (
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Base price</label>
            <Input
              type="number"
              min={0}
              value={base || ''}
              onChange={(e) => onUpdate({ basePricePerUnit: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0"
              className="h-8 text-xs"
            />
          </div>
        )}

        <div className={pricingType === 'SHARED' ? '' : 'col-span-2'}>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Currency</label>
          <select
            value={currency}
            onChange={(e) => onUpdate({ currency: e.target.value })}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Calculated pricing summary */}
      {base > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
          <span className={`text-[10px] font-medium ${pricingType === 'SHARED' ? 'text-info' : 'text-warning'}`}>
            {pricingType === 'SHARED' ? '⇄ SHARED' : '⊕ PRIVATE'} · {calculatedLabel}
          </span>
          {sellPrice != null && (
            <span className="text-xs font-bold text-primary">{currency} {sellPrice}/pax</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline debounced service search with dropdown — mirrors the one in LeadCreateDialog. */
function ServiceInlineSearch({
  value, destination, onValueChange, onSelect,
}: {
  value: string;
  destination?: string;
  onValueChange: (v: string) => void;
  onSelect: (s: import('@shared/types/domain').Service) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQ(value); }, [value]);

  const { data } = useQuery({
    queryKey: ['services', 'inline-search', q, destination],
    queryFn: () => servicesService.search({ search: q, destination, limit: 6 }),
    enabled: q.trim().length > 1,
    staleTime: 30_000,
  });
  const results = data?.items ?? [];

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); onValueChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Service name…"
        className="h-8 text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-lg border border-border bg-card shadow-xl max-h-48 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
              onMouseDown={() => { onSelect(s); setQ(s.name); setOpen(false); }}
            >
              <Wrench className="size-3 shrink-0 text-muted-foreground" />
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {INTERNAL_CURRENCY} {Math.round(toInternalAed(s.defaultSellPrice ?? s.basePrice ?? 0, s.currency)).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hotel grouping (same key as whatsapp.ts) ──────────────────────────────────

function hotelGroupKey(opt: LeadHotelOption): string {
  return `${(opt.name ?? '').trim()}|${(opt.location ?? '').trim()}|${opt.starRating ?? ''}`.toLowerCase();
}

interface HotelGroup {
  key: string;
  name: string;
  starRating?: number;
  location?: string;
  recommended: boolean;
  /** indices into the flat options[] array */
  indices: number[];
}

function buildHotelGroups(options: LeadHotelOption[]): HotelGroup[] {
  const map = new Map<string, HotelGroup>();
  options.forEach((opt, i) => {
    const key = hotelGroupKey(opt);
    if (!map.has(key)) {
      map.set(key, { key, name: opt.name ?? '', starRating: opt.starRating, location: opt.location, recommended: opt.recommended ?? false, indices: [i] });
    } else {
      const g = map.get(key)!;
      g.recommended = g.recommended || (opt.recommended ?? false);
      g.indices.push(i);
    }
  });
  return [...map.values()];
}

const emptyOption: LeadHotelOption = {
  name: '',
  starRating: undefined,
  location: '',
  roomType: '',
  currency: INTERNAL_CURRENCY,
  roomCount: 1,
  maxOccupancy: DEFAULT_ROOM_OCCUPANCY,
  nights: 1,
  pricePerPerson: undefined,
  recommended: false,
};

function HotelOptionsEditor({
  options,
  currency,
  pax,
  defaultNights,
  sourceCurrency,
  onChange,
  suggestions = [],
}: {
  options: LeadHotelOption[];
  currency: string;
  pax: number;
  defaultNights: number;
  sourceCurrency: string;
  onChange: (v: LeadHotelOption[]) => void;
  suggestions?: string[];
}) {
  const groups = buildHotelGroups(options);

  const norm = (o: LeadHotelOption) =>
    normalizeHotelOption(o, { pax, fallbackNights: defaultNights, fallbackCurrency: sourceCurrency });

  // Update hotel-level fields across all entries in the group
  const updateGroupHotel = (groupKey: string, patch: { name?: string; starRating?: number; location?: string }) =>
    onChange(options.map((o, i) => {
      const g = groups.find((g2) => g2.key === groupKey);
      if (!g?.indices.includes(i)) return o;
      return norm({ ...o, ...patch });
    }));

  // Update one room-type row by flat index
  const updateRoom = (idx: number, patch: Partial<LeadHotelOption>) =>
    onChange(options.map((o, i) => i === idx ? norm({ ...o, ...patch }) : o));

  // Remove one room-type row (keep at least 1 per group enforced by UI)
  const removeRoom = (idx: number) => onChange(options.filter((_, i) => i !== idx));

  // Remove all entries for an option (hotel group)
  const removeOption = (groupKey: string) => {
    const g = groups.find((g2) => g2.key === groupKey);
    if (!g) return;
    const drop = new Set(g.indices);
    onChange(options.filter((_, i) => !drop.has(i)));
  };

  // Add a new room-type row inside an existing group
  const addRoomType = (groupKey: string) => {
    const g = groups.find((g2) => g2.key === groupKey);
    if (!g) return;
    const lastIdx = g.indices[g.indices.length - 1];
    const source = options[lastIdx];
    const newRow = norm({ ...source, roomType: '', pricePerNight: undefined, paxCount: undefined, occupancyType: 'DOUBLE', recommended: false });
    const updated = [...options];
    updated.splice(lastIdx + 1, 0, newRow);
    onChange(updated);
  };

  // Add a brand-new empty hotel option
  const addOption = () => onChange([...options, norm({ ...emptyOption })]);
  const addNamed = (name: string) => onChange([...options, norm({ ...emptyOption, name })]);

  // Toggle recommended — only one group at a time
  const setRecommended = (groupKey: string) => {
    const g = groups.find((g2) => g2.key === groupKey);
    if (!g) return;
    const nowRec = g.recommended;
    onChange(options.map((o, i) => ({ ...o, recommended: g.indices.includes(i) ? !nowRec : false })));
  };

  return (
    <div className="space-y-4">
      <SuggestionRow label="Requested by client" items={suggestions} onAdd={addNamed} />
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No hotel options yet. Add one to start quoting.</p>
      )}

      {groups.map((group, groupIdx) => {
        const normOpts = group.indices.map((i) => norm(options[i]));
        const hasMixed = normOpts.some((o) => o.paxCount != null && o.paxCount > 0 && o.paxCount < pax);
        let blendedAed: number | null = null;
        if (hasMixed) {
          let cost = 0, alloc = 0;
          for (const o of normOpts) { const sp = o.paxCount ?? pax; cost += (o.pricePerPerson ?? 0) * sp; alloc += sp; }
          if (alloc > 0) blendedAed = Math.round(cost / pax);
        }
        const totalRooms = normOpts.reduce((s, o) => s + (o.roomCount ?? 1), 0);

        return (
          <div key={group.key} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Option header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary shrink-0">
                Option {groupIdx + 1}
              </span>
              {group.name && <span className="text-sm text-foreground font-medium truncate">{group.name}{group.starRating ? ` · ${group.starRating}★` : ''}{group.location ? ` · ${group.location}` : ''}</span>}
              <button
                type="button"
                onClick={() => setRecommended(group.key)}
                className={group.recommended
                  ? 'ml-auto inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                  : 'ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground'}
              >
                <Star className={group.recommended ? 'size-3.5 fill-current' : 'size-3.5'} />
                {group.recommended ? 'Recommended' : 'Recommend'}
              </button>
              <button type="button" onClick={() => removeOption(group.key)} className="text-muted-foreground hover:text-danger" aria-label="Remove option">
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Hotel-level: name / stars / location */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <HotelAutocomplete
                    value={group.name}
                    onChange={(name) => updateGroupHotel(group.key, { name })}
                    onSelect={(h) => updateGroupHotel(group.key, {
                      name: h.name,
                      starRating: h.starRating,
                      location: [h.area, h.city].filter(Boolean).join(', '),
                    })}
                  />
                </div>
                <Input
                  type="number" min={0} max={7}
                  value={group.starRating ?? ''}
                  onChange={(e) => updateGroupHotel(group.key, { starRating: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="★" className="w-14 text-center"
                />
                <Input
                  value={group.location ?? ''}
                  onChange={(e) => updateGroupHotel(group.key, { location: e.target.value })}
                  placeholder="City / area" className="w-36"
                />
              </div>

              {/* Room-type rows */}
              <div className="rounded-md border border-border overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_90px_80px_68px_80px_60px_36px] bg-muted/60 border-b border-border">
                  {['Room type', 'Occupancy', 'Seg. pax', 'Rooms', 'AED / night', 'Nights', ''].map((h) => (
                    <div key={h} className="px-2.5 py-2 text-[10px] font-medium text-muted-foreground">{h}</div>
                  ))}
                </div>

                {group.indices.map((optIdx, rowIdx) => {
                  const opt = normOpts[rowIdx];
                  return (
                    <div
                      key={optIdx}
                      className={`grid grid-cols-[1fr_90px_80px_68px_80px_60px_36px] items-center${rowIdx < group.indices.length - 1 ? ' border-b border-border/60' : ''}`}
                    >
                      <div className="px-2 py-1.5">
                        <RoomTypeInput
                          value={opt.roomType ?? ''}
                          onChange={(roomType) => updateRoom(optIdx, { roomType })}
                          placeholder="e.g. Deluxe BB"
                          className="border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-none px-0"
                        />
                      </div>
                      <div className="px-1 py-1.5">
                        <Select
                          value={opt.occupancyType ?? 'DOUBLE'}
                          onChange={(e) => {
                            const type = e.target.value as 'SINGLE' | 'DOUBLE' | 'TRIPLE';
                            updateRoom(optIdx, { occupancyType: type, maxOccupancy: occupancyToMax(type), roomCount: undefined });
                          }}
                          options={[
                            { value: 'SINGLE', label: 'Single' },
                            { value: 'DOUBLE', label: 'Double' },
                            { value: 'TRIPLE', label: 'Triple' },
                          ]}
                          className="border-0 bg-transparent shadow-none text-sm"
                        />
                      </div>
                      <div className="px-1 py-1.5">
                        <Input
                          type="number" min={1}
                          value={opt.paxCount ?? ''}
                          onChange={(e) => updateRoom(optIdx, { paxCount: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder={`${pax}`}
                          title="Pax in this segment (leave blank for all pax)"
                          className="border-0 bg-transparent shadow-none text-center px-1"
                        />
                      </div>
                      <div className="px-1 py-1.5">
                        <Input
                          type="number" min={1}
                          value={opt.roomCount ?? ''}
                          onChange={(e) => updateRoom(optIdx, { roomCount: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="1"
                          className="border-0 bg-transparent shadow-none text-center px-1"
                        />
                      </div>
                      <div className="px-1 py-1.5">
                        <Input
                          type="number" min={0}
                          value={opt.pricePerNight ?? ''}
                          onChange={(e) => updateRoom(optIdx, { pricePerNight: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="0"
                          className="border-0 bg-transparent shadow-none text-center px-1"
                        />
                      </div>
                      <div className="px-1 py-1.5">
                        <Input
                          type="number" min={1}
                          value={opt.nights ?? ''}
                          onChange={(e) => updateRoom(optIdx, { nights: e.target.value === '' ? undefined : Number(e.target.value) })}
                          placeholder="1"
                          className="border-0 bg-transparent shadow-none text-center px-1"
                        />
                      </div>
                      <div className="flex items-center justify-center px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeRoom(optIdx)}
                          disabled={group.indices.length === 1}
                          className="rounded p-0.5 text-muted-foreground hover:text-danger disabled:opacity-20 transition-colors"
                          title="Remove room type"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add row */}
                <div className="border-t border-border/60 bg-muted/30 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => addRoomType(group.key)}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="size-3" /> Add room type
                  </button>
                </div>
              </div>

              {/* Pricing summary */}
              <div className="flex items-center justify-between rounded-md bg-primary/5 border border-primary/10 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {hasMixed
                    ? normOpts.map((o) => {
                        const sp = o.paxCount ?? pax;
                        const lbl = o.occupancyType === 'SINGLE' ? 'Single' : o.occupancyType === 'TRIPLE' ? 'Triple' : 'Double';
                        return `${sp} pax (${lbl})`;
                      }).join(' + ')
                    : (() => {
                        const o = normOpts[0];
                        const lbl = o?.occupancyType === 'SINGLE' ? 'Single' : o?.occupancyType === 'TRIPLE' ? 'Triple' : 'Double';
                        return `${pax} pax · ${lbl} occ. · ${totalRooms} room${totalRooms > 1 ? 's' : ''}`;
                      })()}
                </span>
                <span className="font-semibold text-primary">
                  {blendedAed != null
                    ? `AED ${blendedAed.toLocaleString()}/pax (blended)`
                    : (() => {
                        const o = normOpts[0];
                        return o?.pricePerPerson != null ? `AED ${Math.round(o.pricePerPerson).toLocaleString()}/pax` : '—';
                      })()}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="secondary" onClick={addOption}>
        <Plus className="size-4" /> Add hotel option
      </Button>
    </div>
  );
}
