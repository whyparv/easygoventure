import { useState } from 'react';
import { Sparkles, TriangleAlert, Wand2 } from 'lucide-react';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Textarea } from '@shared/components/ui/textarea';
import { Select } from '@shared/components/ui/select';
import { Badge } from '@shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { useCreateLead } from '@shared/mutations/leads.mutations';
import { useCreateInquiry } from '@shared/mutations/inquiries.mutations';
import { useParseInquiry } from '@shared/mutations/ai.mutations';
import { InquiryType, LeadSource, type InquiryType as InquiryTypeT, type LeadSource as LeadSourceT } from '@shared/types/domain';
import { titleCase } from '@shared/lib/format';
import { serviceToInquiryType } from '@shared/lib/inquiry';
import type { Tone } from '@shared/lib/status';

const SOURCE_OPTIONS = LeadSource.map((s) => ({ label: titleCase(s), value: s }));
const TYPE_OPTIONS = InquiryType.map((t) => ({ label: titleCase(t), value: t }));

interface Fields {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  source: LeadSourceT;
  inquiryType: InquiryTypeT;
  destination: string;
  travelDate: string;
  budget: string;
  travelers: string;
  notes: string;
}

const EMPTY: Fields = {
  name: '', phone: '', email: '', companyName: '', source: 'WHATSAPP', inquiryType: 'TRAVEL_PACKAGE',
  destination: '', travelDate: '', budget: '', travelers: '', notes: '',
};

function confidenceTone(c: number): Tone {
  if (c >= 70) return 'success';
  if (c >= 40) return 'warning';
  return 'danger';
}

/** Keep traveller count in 1–100 (never negative/zero). Empty stays empty. */
function clampTravelers(value: string): string {
  if (value.trim() === '') return '';
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) return '';
  return String(Math.max(1, Math.min(100, n)));
}

/**
 * Single entry point for lead creation: AI-Assisted (paste WhatsApp/email/text →
 * extract → review → create) or Manual. On create it also auto-creates the Inquiry.
 */
export function LeadCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (leadId: string) => void;
}) {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [raw, setRaw] = useState('');
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  // AI-parsed working brief (kept separate from the selected services/hotels).
  const [req, setReq] = useState<{ note?: string; services: string[]; hotels: string[] }>({
    services: [],
    hotels: [],
  });

  const parse = useParseInquiry();
  const createLead = useCreateLead();
  const createInquiry = useCreateInquiry();
  const submitting = createLead.isPending;

  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  const reset = () => {
    setRaw('');
    setFields(EMPTY);
    setConfidence(null);
    setMissing([]);
    setReq({ services: [], hotels: [] });
    setMode('ai');
  };
  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const extract = () => {
    if (!raw.trim()) return;
    parse.mutate(raw, {
      onSuccess: (p) => {
        set({
          name: p.customerName ?? fields.name,
          phone: p.customerPhone ?? fields.phone,
          email: p.customerEmail ?? fields.email,
          companyName: p.agencyName ?? fields.companyName,
          destination: p.destination ?? fields.destination,
          travelDate: p.travelDate ?? fields.travelDate,
          budget: p.budget != null ? String(p.budget) : fields.budget,
          travelers:
            p.travelers != null
              ? String(p.travelers)
              : p.adults != null || p.children != null
                ? String((p.adults ?? 0) + (p.children ?? 0))
                : fields.travelers,
          inquiryType: serviceToInquiryType(p.service),
        });
        setConfidence(p.confidence);
        setMissing(p.missing ?? []);
        setReq({ note: p.requirementsNote ?? undefined, services: p.services ?? [], hotels: p.requestedHotels ?? [] });
      },
    });
  };

  const create = async () => {
    try {
      const lead = await createLead.mutateAsync({
        name: fields.name.trim() || undefined,
        phone: fields.phone.trim() || undefined,
        email: fields.email || undefined,
        companyName: fields.companyName || undefined,
        source: fields.source,
        inquiryType: fields.inquiryType,
        notes: fields.notes || undefined,
        rawInquiry: raw || undefined,
        // Persist the inquiry basics onto the lead itself (lead-centric model).
        destination: fields.destination || undefined,
        travelDate: fields.travelDate || undefined,
        adults: fields.travelers ? Number(fields.travelers) : undefined,
        // The AI-parsed working brief (empty for a purely manual lead).
        requirementsNote: req.note,
        requestedServices: req.services.length ? req.services : undefined,
        requestedHotels: req.hotels.length ? req.hotels : undefined,
      });
      onCreated?.(lead.id);
      close();
      // Best-effort legacy inquiry mirror — never blocks lead capture.
      if (fields.name.trim()) {
        createInquiry.mutate(
          {
            customerName: fields.name.trim(),
            customerPhone: fields.phone || undefined,
            customerEmail: fields.email || undefined,
            companyName: fields.companyName || undefined,
            source: fields.source,
            destination: fields.destination || undefined,
            travelers: fields.travelers ? Number(fields.travelers) : undefined,
            travelDate: fields.travelDate || undefined,
            budget: fields.budget ? Number(fields.budget) : undefined,
            rawInquiry: raw || undefined,
          },
          { onError: () => {} },
        );
      }
    } catch {
      /* errors surface via mutation toasts */
    }
  };

  // Nothing is mandatory — a travel-agency inquiry rarely arrives complete.
  const canCreate = true;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title="Capture inquiry"
      description="Log a travel-agency inquiry — add whatever details you have. Nothing is required; you can enrich the lead later."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={!canCreate} loading={submitting}>
            Create lead
          </Button>
        </>
      }
    >
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'ai' | 'manual')}>
        <TabsList>
          <TabsTrigger value="ai">
            <Sparkles className="mr-1.5 size-3.5" /> AI Assisted
          </TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <div className="space-y-3 pt-3">
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                Paste a WhatsApp message, email, or enquiry
              </span>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={4}
                placeholder="e.g. Hi, this is Aisha (+971 50 123 4567). We're 2 adults + 1 child looking for a 5-day Dubai package in December, budget around 15000 AED…"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={extract} loading={parse.isPending} disabled={!raw.trim()}>
                <Wand2 /> Extract with AI
              </Button>
              {confidence !== null && (
                <Badge tone={confidenceTone(confidence)} dot>
                  {confidence}% confidence
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">Review &amp; edit the fields below, then create.</span>
            </div>
            {confidence !== null && missing.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Not detected:</span> {missing.join(', ')} — optional, you can add these later.
                </span>
              </div>
            )}
            <ExtractedFields fields={fields} set={set} showTrip />
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="pt-3">
            <ExtractedFields fields={fields} set={set} showTrip={false} />
          </div>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

function ExtractedFields({
  fields,
  set,
  showTrip,
}: {
  fields: Fields;
  set: (patch: Partial<Fields>) => void;
  showTrip: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Contact person">
        <Input value={fields.name} onChange={(e) => set({ name: e.target.value })} placeholder="Aisha Khan" />
      </Field>
      <Field label="Phone / WhatsApp">
        <Input value={fields.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+971 50 000 0000" />
      </Field>
      <Field label="Email">
        <Input type="email" value={fields.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@agency.com" />
      </Field>
      <Field label="Agency">
        <Input value={fields.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Travel Connect" />
      </Field>
      <Field label="Source">
        <Select options={SOURCE_OPTIONS} value={fields.source} onChange={(e) => set({ source: e.target.value as LeadSourceT })} />
      </Field>
      <Field label="Inquiry type">
        <Select options={TYPE_OPTIONS} value={fields.inquiryType} onChange={(e) => set({ inquiryType: e.target.value as InquiryTypeT })} />
      </Field>
      {showTrip && (
        <>
          <Field label="Destination">
            <Input value={fields.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="Dubai" />
          </Field>
          <Field label="Travel date">
            <Input type="date" value={fields.travelDate} onChange={(e) => set({ travelDate: e.target.value })} />
          </Field>
          <Field label="Travellers">
            <Input
              type="number"
              min={1}
              max={100}
              value={fields.travelers}
              onChange={(e) => set({ travelers: clampTravelers(e.target.value) })}
            />
          </Field>
          <Field label="Budget">
            <Input
              type="number"
              min={0}
              value={fields.budget}
              onChange={(e) => set({ budget: e.target.value.replace(/-/g, '') })}
            />
          </Field>
        </>
      )}
      <label className="col-span-2 space-y-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <Textarea value={fields.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
      </label>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
