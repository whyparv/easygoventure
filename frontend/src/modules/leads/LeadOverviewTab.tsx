import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  ConciergeBell,
  Lightbulb,
  MessageCircle,
  Plus,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { useUpdateLead } from '@shared/mutations/leads.mutations';
import { useAuthStore } from '@shared/stores/auth.store';
import { formatCurrency } from '@shared/lib/format';
import type { UpdateLeadInput } from '@shared/services/leads.service';
import type { Lead, LeadHotelOption, LeadServiceItem } from '@shared/types/domain';
import { AgencyAutocomplete } from './AgencyAutocomplete';
import { HotelAutocomplete } from './HotelAutocomplete';
import { ServicePickerModal } from './ServicePickerModal';
import { WhatsAppQuoteModal } from './WhatsAppQuoteModal';

const CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'NGN'];

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
    currency: lead.currency ?? 'USD',
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
      hotelOptions: form.hotelOptions,
      markup: toNum(form.markup),
      currency: form.currency || undefined,
      quoteValidityHours: toNum(form.quoteValidityHours),
      preparedBy: form.preparedBy.trim() || undefined,
    }),
    [form],
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
          suggestions={requestedServices.filter((s) => !isRequirementFulfilled(s, form.serviceItems))}
        />
      </Section>

      {/* ── Hotel options ──────────────────────────────────────────────── */}
      <Section title="Hotel Options">
        <HotelOptionsEditor
          options={form.hotelOptions}
          currency={form.currency}
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
 * Catalog-driven service selection. Attached services are snapshots (name + price)
 * shown as chips; "Add Service" opens the searchable catalog picker. Client-
 * requested services surface as one-click suggestions (matched to the catalog).
 */
function ServicesPicker({
  value,
  onChange,
  destination,
  suggestions = [],
}: {
  value: LeadServiceItem[];
  onChange: (v: LeadServiceItem[]) => void;
  destination?: string;
  suggestions?: string[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // The generic requirement the picker is currently fulfilling (null = plain "Add Service").
  const [requirement, setRequirement] = useState<string | null>(null);

  const has = (name: string) =>
    value.some((s) => s.serviceName.trim().toLowerCase() === name.trim().toLowerCase());

  const add = (item: LeadServiceItem) => {
    if (has(item.serviceName)) return;
    onChange([...value, item]);
  };
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const openPicker = (req: string | null) => {
    setRequirement(req);
    setPickerOpen(true);
  };

  return (
    <div className="space-y-3">
      {/* A requirement is generic (e.g. "Airport Transfer"); clicking it opens the
          catalog to choose a specific variant — it is never auto-selected. */}
      <SuggestionRow label="Requested by client — pick a variant" items={suggestions} onAdd={openPicker} />

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet. Add from the catalog to build the quote.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((s, i) => (
            <span
              key={`${s.serviceName}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary"
            >
              <ConciergeBell className="size-3.5" />
              {s.serviceName}
              {s.sellPrice != null && (
                <span className="text-xs opacity-70">{formatCurrency(s.sellPrice, s.currency)}</span>
              )}
              <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${s.serviceName}`}>
                <Trash2 className="size-3.5 opacity-60 hover:opacity-100" />
              </button>
            </span>
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

const emptyOption: LeadHotelOption = {
  name: '',
  starRating: undefined,
  location: '',
  roomType: '',
  pricePerPerson: undefined,
  recommended: false,
};

function HotelOptionsEditor({
  options,
  currency,
  onChange,
  suggestions = [],
}: {
  options: LeadHotelOption[];
  currency: string;
  onChange: (v: LeadHotelOption[]) => void;
  suggestions?: string[];
}) {
  const update = (i: number, patch: Partial<LeadHotelOption>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));

  const add = () => onChange([...options, { ...emptyOption }]);

  const addNamed = (name: string) => onChange([...options, { ...emptyOption, name }]);

  // Only one option can be the recommended hotel.
  const setRecommended = (i: number) =>
    onChange(options.map((o, idx) => ({ ...o, recommended: idx === i ? !o.recommended : false })));

  return (
    <div className="space-y-3">
      <SuggestionRow label="Requested by client" items={suggestions} onAdd={addNamed} />
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">No hotel options yet. Add one or two to quote.</p>
      )}
      {options.map((opt, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Option {i + 1}</span>
            <button
              type="button"
              onClick={() => setRecommended(i)}
              className={
                opt.recommended
                  ? 'ml-auto inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                  : 'ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground'
              }
              title="Mark as recommended"
            >
              <Star className={opt.recommended ? 'size-3.5 fill-current' : 'size-3.5'} />
              {opt.recommended ? 'Recommended' : 'Recommend'}
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-danger"
              aria-label="Remove option"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <HotelAutocomplete
            value={opt.name}
            onChange={(name) => update(i, { name })}
            onSelect={(h) =>
              update(i, {
                name: h.name,
                starRating: h.starRating,
                location: [h.area, h.city].filter(Boolean).join(', '),
              })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              max={7}
              value={opt.starRating ?? ''}
              onChange={(e) => update(i, { starRating: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="Stars"
            />
            <Input
              value={opt.location ?? ''}
              onChange={(e) => update(i, { location: e.target.value })}
              placeholder="Location"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={opt.roomType ?? ''}
              onChange={(e) => update(i, { roomType: e.target.value })}
              placeholder="Room type"
            />
            <Input
              type="number"
              min={0}
              value={opt.pricePerPerson ?? ''}
              onChange={(e) =>
                update(i, { pricePerPerson: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder={`Price/person (${currency})`}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add}>
        <Plus className="size-4" /> Add hotel option
      </Button>
    </div>
  );
}
