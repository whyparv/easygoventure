import { useEffect, useRef, useState } from 'react';
import {
  Bot, Building2, Calendar, DollarSign, Globe, Mail, MapPin,
  Phone, Plus, Send, TriangleAlert, User, Users, Wrench, X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@shared/components/ui/modal';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { useCreateLead } from '@shared/mutations/leads.mutations';
import { useCreateInquiry } from '@shared/mutations/inquiries.mutations';
import { useLeadIntakeChat } from '@shared/mutations/ai.mutations';
import type { ExtractedHotel, ExtractedLeadData, ExtractedService, ChatTurn } from '@shared/services/ai.service';
import { hotelsService } from '@shared/services/hotels.service';
import { servicesService } from '@shared/services/services.service';
import type { Hotel } from '@shared/types/ops-domain';
import type { Service } from '@shared/types/domain';
import {
  InquiryType, LeadSource,
  type InquiryType as InquiryTypeT,
  type LeadLocation,
  type LeadSource as LeadSourceT,
} from '@shared/types/domain';
import { titleCase } from '@shared/lib/format';
import { cn } from '@shared/utils/cn';

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SOURCE_OPTIONS = LeadSource.map((s) => ({ label: titleCase(s), value: s }));
const TYPE_OPTIONS = InquiryType.map((t) => ({ label: titleCase(t), value: t }));

// ── Fields interface ─────────────────────────────────────────────────────────

interface Fields {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  source: LeadSourceT;
  inquiryType: InquiryTypeT;
  startDate: string;
  endDate: string;
  budget: string;
  travelers: string;
  adults: string;
  children: string;
  infants: string;
  nationality: string;
  notes: string;
  locations: LeadLocation[];
  hotels: ExtractedHotel[];
  services: ExtractedService[];
}

const EMPTY: Fields = {
  name: '', phone: '', email: '', companyName: '',
  source: 'WHATSAPP', inquiryType: 'TRAVEL_PACKAGE',
  startDate: '', endDate: '', budget: '', travelers: '',
  adults: '', children: '', infants: '', nationality: '', notes: '',
  locations: [], hotels: [], services: [],
};

// ── Pricing helpers ──────────────────────────────────────────────────────────

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function hotelPricePerNight(hotel: ExtractedHotel): number {
  const stars = hotel.rating ?? 4;
  const ranges: Record<number, [number, number]> = {
    5: [800, 1200], 4: [400, 700], 3: [200, 350], 2: [100, 200], 1: [60, 100],
  };
  const [min, max] = ranges[Math.round(stars)] ?? [200, 400];
  const h = hashName(hotel.name ?? hotel.city ?? 'hotel');
  return min + (h % (max - min + 1));
}

interface ServicePricing { pricePerPerson: number; total: number }
function calcServicePrice(svc: ExtractedService, pax: number): ServicePricing | null {
  if (!svc.basePricePerUnit) return null;
  if (svc.pricingType === 'SHARED') {
    const cap = svc.capacity ?? 1;
    const units = Math.ceil(pax / cap);
    const total = units * svc.basePricePerUnit;
    return { pricePerPerson: total / pax, total };
  }
  return { pricePerPerson: svc.basePricePerUnit, total: svc.basePricePerUnit * pax };
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function inferHotelDates(hotels: ExtractedHotel[], tripStart?: string): ExtractedHotel[] {
  if (!tripStart || !hotels.length) return hotels;
  let cursor = tripStart;
  return hotels.map((h) => {
    const checkIn = h.checkIn ?? cursor;
    const nights = h.nights ?? 1;
    const checkOut = h.checkOut ?? addDays(checkIn, nights);
    cursor = checkOut;
    return { ...h, checkIn, checkOut, nights };
  });
}

function buildLocationsFromHotels(hotels: ExtractedHotel[]): LeadLocation[] {
  const seen = new Set<string>();
  return hotels
    .filter((h) => h.city)
    .reduce<LeadLocation[]>((acc, h) => {
      const key = (h.city ?? '').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        acc.push({ locationId: uuid(), city: h.city!, hotels: [], nights: h.nights });
      }
      return acc;
    }, []);
}

function mergeExtracted(fields: Fields, data: ExtractedLeadData): Fields {
  const startDate = (data as Record<string, unknown>).startDate as string
    ?? data.travelDate ?? fields.startDate;

  const rawHotels = data.hotels?.length ? data.hotels : fields.hotels;
  const hotels = inferHotelDates(rawHotels, startDate || undefined);

  let locations = fields.locations;
  if (hotels.length > 0) {
    const fromHotels = buildLocationsFromHotels(hotels);
    // Merge: keep existing if same city, add new ones
    const existingCities = new Set(fields.locations.map((l) => l.city.toLowerCase()));
    const newOnes = fromHotels.filter((l) => !existingCities.has(l.city.toLowerCase()));
    locations = fields.locations.length > 0
      ? [...fields.locations, ...newOnes]
      : fromHotels;
  } else if (data.destination && !fields.locations.length) {
    locations = data.destination
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((city) => ({ locationId: uuid(), city, hotels: [], nights: undefined }));
  }

  const adults = data.adults != null ? String(data.adults) : fields.adults;
  const children = data.children != null ? String(data.children) : fields.children;
  const infants = data.infants != null ? String(data.infants) : fields.infants;
  const autoTravelers = data.travelers != null
    ? String(data.travelers)
    : (data.adults != null || data.children != null || data.infants != null)
      ? String((data.adults ?? 0) + (data.children ?? 0) + (data.infants ?? 0))
      : fields.travelers;

  return {
    ...fields,
    name: data.name || fields.name,
    phone: data.phone || fields.phone,
    email: data.email || fields.email,
    companyName: data.companyName || fields.companyName,
    source: (data.source as LeadSourceT) || fields.source,
    inquiryType: (data.inquiryType as InquiryTypeT) || fields.inquiryType,
    startDate,
    endDate: (data as Record<string, unknown>).endDate as string ?? fields.endDate,
    budget: data.budget != null ? String(data.budget) : fields.budget,
    travelers: autoTravelers,
    adults, children, infants,
    nationality: data.nationality || fields.nationality,
    notes: data.notes || fields.notes,
    hotels,
    services: data.services?.length ? data.services : fields.services,
    locations,
  };
}

interface ChatMsg { id: string; role: 'user' | 'assistant'; content: string }

// ── Main component ───────────────────────────────────────────────────────────

export function LeadCreateDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (leadId: string, whatsappGreeting?: string) => void;
}) {
  const [mode, setMode] = useState<'chat' | 'manual'>('chat');
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [msgs, setMsgs] = useState<ChatMsg[]>([{
    id: 'init', role: 'assistant',
    content: "Hi! Paste a WhatsApp message or describe the trip — I'll extract everything: names, hotels, services, dates, pricing.",
  }]);
  const [chatInput, setChatInput] = useState('');
  const [extracted, setExtracted] = useState<ExtractedLeadData>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [whatsappGreeting, setWhatsappGreeting] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const intakeChat = useLeadIntakeChat();
  const createLead = useCreateLead();
  const createInquiry = useCreateInquiry();
  const submitting = createLead.isPending || createInquiry.isPending;

  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || intakeChat.isPending) return;
    const history: ChatTurn[] = msgs
      .filter((m) => m.id !== 'init')
      .map((m) => ({ role: m.role, content: m.content }));
    setMsgs((p) => [...p, { id: uuid(), role: 'user', content: text }]);
    setChatInput('');
    intakeChat.mutate({ message: text, history, extractedData: extracted }, {
      onSuccess: (res) => {
        setMsgs((p) => [...p, { id: uuid(), role: 'assistant', content: res.reply }]);
        setExtracted(res.extractedData);
        setMissing(res.missingFields);
        setFields((prev) => mergeExtracted(prev, res.extractedData));
        if (res.whatsappGreeting) setWhatsappGreeting(res.whatsappGreeting);
        setTimeout(() => inputRef.current?.focus(), 50);
      },
    });
  };

  const reset = () => {
    setFields(EMPTY);
    setMsgs([{ id: 'init', role: 'assistant', content: "Hi! Paste a WhatsApp message or describe the trip — I'll extract everything: names, hotels, services, dates, pricing." }]);
    setChatInput(''); setExtracted({}); setMissing([]); setWhatsappGreeting(''); setMode('chat');
  };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const create = async () => {
    try {
      // Map extracted hotels → structured hotel options with deterministic pricing
      const hotelOptions = fields.hotels.map((h, idx) => {
        const hotelNights = h.nights ?? totalNights ?? 1;
        const rooms = h.roomCount ?? 1;
        const pricePerNight = hotelPricePerNight(h);
        const pricePerPerson = Math.round((pricePerNight * hotelNights * rooms) / Math.max(1, pax));
        return {
          name: h.name ?? `${h.rating ?? 4}-Star Hotel ${h.city ?? ''}`.trim(),
          starRating: h.rating,
          location: h.city ?? undefined,
          pricePerPerson,
          recommended: idx === 0,
        };
      });

      // Map extracted services → structured service items with calculated pricing
      const serviceItems = fields.services
        .filter((s) => s.name)
        .map((s) => {
          const pricing = calcServicePrice(s, Math.max(1, pax));
          return {
            serviceName: s.name!,
            currency: s.currency ?? 'AED',
            basePricePerUnit: s.basePricePerUnit ?? undefined,
            pricingType: (s.pricingType as 'PRIVATE' | 'SHARED') ?? 'PRIVATE',
            capacity: s.capacity ?? undefined,
            sellPrice: pricing ? Math.round(pricing.pricePerPerson) : undefined,
            snapshotDate: new Date().toISOString().slice(0, 10),
          };
        });

      const destination =
        fields.locations.map((l) => l.city).filter(Boolean).join(', ') ||
        fields.hotels[0]?.city ||
        undefined;

      const noteParts = [
        fields.notes,
        fields.nationality ? `Nationality: ${fields.nationality}` : '',
        fields.infants ? `Infants: ${fields.infants}` : '',
      ].filter(Boolean);

      const lead = await createLead.mutateAsync({
        name: fields.name.trim() || undefined,
        phone: fields.phone.trim() || undefined,
        email: fields.email || undefined,
        companyName: fields.companyName || undefined,
        source: fields.source,
        inquiryType: fields.inquiryType,
        startDate: fields.startDate || undefined,
        endDate: fields.endDate || undefined,
        travelDate: fields.startDate || undefined,
        returnDate: fields.endDate || undefined,
        adults: fields.adults ? Number(fields.adults) : undefined,
        children: fields.children ? Number(fields.children) : undefined,
        notes: noteParts.join('\n') || undefined,
        locations: fields.locations.length > 0 ? fields.locations : undefined,
        destination,
        nights: totalNights ?? undefined,
        hotelOptions: hotelOptions.length > 0 ? hotelOptions : undefined,
        serviceItems: serviceItems.length > 0 ? serviceItems : undefined,
        services: fields.services.map((s) => s.name).filter(Boolean) as string[],
        requestedHotels: fields.hotels
          .map((h) => [h.name, h.city].filter(Boolean).join(', '))
          .filter(Boolean),
        requestedServices: fields.services
          .map((s) => s.name)
          .filter(Boolean) as string[],
      });
      await createInquiry.mutateAsync({
        customerName: fields.name.trim(),
        customerPhone: fields.phone || undefined,
        customerEmail: fields.email || undefined,
        companyName: fields.companyName || undefined,
        source: fields.source,
        destination,
        travelers: pax,
        travelDate: fields.startDate || undefined,
        budget: fields.budget ? Number(fields.budget) : undefined,
      });
      onCreated?.(lead.id, whatsappGreeting || undefined);
      close();
    } catch { /* toasts handle errors */ }
  };

  const canCreate = Boolean(fields.name.trim() && fields.phone.trim());
  const totalNights = fields.startDate && fields.endDate
    ? Math.round((new Date(fields.endDate).getTime() - new Date(fields.startDate).getTime()) / 86_400_000)
    : null;
  const pax = Math.max(1,
    fields.travelers ? Number(fields.travelers)
      : (Number(fields.adults) || 0) + (Number(fields.children) || 0) + (Number(fields.infants) || 0) || 1,
  );

  const addHotel = () => set({ hotels: [...fields.hotels, { city: '', name: '', nights: 1, rating: 4, roomCount: 1 }] });
  const addService = () => set({ services: [...fields.services, { name: '', serviceType: 'other', pricingType: 'PRIVATE', basePricePerUnit: 0, currency: 'AED' }] });

  const rightPanel = (
    <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">

      {/* Contact */}
      <Section icon={User} label="Contact">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Full name" required highlight={!!fields.name}>
            <Input value={fields.name} onChange={(e) => set({ name: e.target.value })} placeholder="Aisha Khan" />
          </Field>
          <Field label="Phone / WhatsApp" required highlight={!!fields.phone}>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={fields.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+971 50 000 0000" className="pl-8" />
            </div>
          </Field>
          <Field label="Email" highlight={!!fields.email}>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" value={fields.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@agency.com" className="pl-8" />
            </div>
          </Field>
          <Field label="Company / Agency" highlight={!!fields.companyName}>
            <Input value={fields.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Acme Travels" />
          </Field>
        </div>
      </Section>

      {/* Trip */}
      <Section icon={Calendar} label="Trip details">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Inquiry type" highlight={fields.inquiryType !== 'TRAVEL_PACKAGE'}>
            <Select options={TYPE_OPTIONS} value={fields.inquiryType} onChange={(e) => set({ inquiryType: e.target.value as InquiryTypeT })} />
          </Field>
          <Field label="Source" highlight={false}>
            <Select options={SOURCE_OPTIONS} value={fields.source} onChange={(e) => set({ source: e.target.value as LeadSourceT })} />
          </Field>
          <Field label="Start date" highlight={!!fields.startDate}>
            <Input type="date" value={fields.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="End date" highlight={!!fields.endDate}>
            <Input type="date" value={fields.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </Field>
          {totalNights != null && totalNights > 0 && (
            <div className="col-span-2 -mt-1 text-xs text-muted-foreground">{totalNights} nights total</div>
          )}
          <Field label="Adults" highlight={!!fields.adults}>
            <div className="relative">
              <Users className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input type="number" min={0} value={fields.adults} onChange={(e) => set({ adults: e.target.value })} placeholder="1" className="pl-8" />
            </div>
          </Field>
          <Field label="Children" highlight={!!fields.children}>
            <Input type="number" min={0} value={fields.children} onChange={(e) => set({ children: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Infants (0-23m)" highlight={!!fields.infants}>
            <Input type="number" min={0} value={fields.infants} onChange={(e) => set({ infants: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Budget" highlight={!!fields.budget}>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input type="number" min={0} value={fields.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="15000" className="pl-8" />
            </div>
          </Field>
          <Field label="Nationality" highlight={!!fields.nationality}>
            <div className="relative">
              <Globe className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={fields.nationality} onChange={(e) => set({ nationality: e.target.value })} placeholder="Indian" className="pl-8" />
            </div>
          </Field>
        </div>
      </Section>

      {/* Destinations */}
      <Section icon={MapPin} label="Destinations">
        <LocationsEditor locations={fields.locations} onChange={(locs) => set({ locations: locs })} />
      </Section>

      {/* Hotels */}
      <Section
        icon={Building2}
        label={`Hotels${fields.hotels.length > 0 ? ` (${fields.hotels.length})` : ''}`}
        action={
          <button onClick={addHotel} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="size-3" /> Add
          </button>
        }
      >
        {fields.hotels.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Mention hotels in the chat or click Add — AI will extract them automatically.</p>
        ) : (
          <div className="space-y-2.5">
            {fields.hotels.map((hotel, i) => (
              <HotelEditor
                key={i}
                hotel={hotel}
                pax={pax}
                onUpdate={(h) => set({ hotels: fields.hotels.map((old, j) => j === i ? h : old) })}
                onRemove={() => set({ hotels: fields.hotels.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Services */}
      <Section
        icon={Wrench}
        label={`Services${fields.services.length > 0 ? ` (${fields.services.length})` : ''}`}
        action={
          <button onClick={addService} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="size-3" /> Add
          </button>
        }
      >
        {fields.services.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Mention activities or services — AI will extract them with pricing.</p>
        ) : (
          <div className="space-y-2.5">
            {fields.services.map((svc, i) => (
              <ServiceEditor
                key={i}
                service={svc}
                pax={pax}
                primaryCity={fields.locations[0]?.city || fields.hotels[0]?.city || 'Dubai'}
                onUpdate={(s) => set({ services: fields.services.map((old, j) => j === i ? s : old) })}
                onRemove={() => set({ services: fields.services.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Notes */}
      <Section icon={null} label="Notes">
        <textarea
          value={fields.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          placeholder="Any additional details, special requests…"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
        />
      </Section>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title="New lead"
      description="AI extracts hotels, services, dates and pricing in real-time."
      className="sm:max-w-[94vw] !max-h-[92vh]"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {canCreate ? (
              <span className="text-success font-medium">✓ Ready to create</span>
            ) : (
              <span>Name &amp; phone required</span>
            )}
            {missing.length > 0 && (
              <span className="flex items-center gap-1 text-warning">
                <TriangleAlert className="size-3" /> Missing: {missing.slice(0, 3).join(', ')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={() => void create()} disabled={!canCreate} loading={submitting}>
              Create lead
            </Button>
          </div>
        </div>
      }
    >
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'chat' | 'manual')}>
        <TabsList className="mb-4">
          <TabsTrigger value="chat"><Bot className="mr-1.5 size-3.5" /> AI Chat</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        {/* ── AI Chat: side-by-side ── */}
        <TabsContent value="chat">
          <div className="grid grid-cols-2 gap-5 h-[64vh]">

            {/* Left: Conversation */}
            <div className="flex flex-col gap-2 h-full min-h-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conversation</p>
              <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/10 p-3 space-y-3 min-h-0">
                {msgs.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border',
                    )}>
                      {msg.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5 text-primary" />}
                    </div>
                    <div className={cn(
                      'max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card border border-border text-foreground rounded-tl-sm',
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {intakeChat.isPending && (
                  <div className="flex gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border">
                      <Bot className="size-3.5 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-2.5 text-sm text-muted-foreground">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce [animation-delay:0ms]">·</span>
                        <span className="animate-bounce [animation-delay:150ms]">·</span>
                        <span className="animate-bounce [animation-delay:300ms]">·</span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  placeholder="Paste WhatsApp message or describe the trip…"
                  disabled={intakeChat.isPending}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <Button size="sm" onClick={sendChat} disabled={!chatInput.trim() || intakeChat.isPending} loading={intakeChat.isPending} className="px-4">
                  <Send className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Right: Live form */}
            <div className="flex flex-col gap-2 h-full min-h-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead details — fills in real-time</p>
              {rightPanel}
            </div>
          </div>
        </TabsContent>

        {/* ── Manual mode ── */}
        <TabsContent value="manual">
          <div className="max-h-[64vh] overflow-y-auto pr-1 space-y-3">
            {rightPanel}
          </div>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

// ── Hotel editor ─────────────────────────────────────────────────────────────

function HotelEditor({
  hotel, pax, onUpdate, onRemove,
}: {
  hotel: ExtractedHotel;
  pax: number;
  onUpdate: (h: ExtractedHotel) => void;
  onRemove: () => void;
}) {
  const nights = hotel.nights ?? 1;
  const rooms = hotel.roomCount ?? 1;
  const pricePerNight = hotelPricePerNight(hotel);
  const total = pricePerNight * nights * rooms;
  const perPerson = Math.round(total / pax);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <HotelSearchInput
            value={hotel.name ?? ''}
            city={hotel.city}
            onValueChange={(v) => onUpdate({ ...hotel, name: v })}
            onSelect={(h) => onUpdate({ ...hotel, name: h.name, rating: h.starRating, city: h.city })}
          />
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-danger shrink-0">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground">City</label>
          <Input value={hotel.city ?? ''} onChange={(e) => onUpdate({ ...hotel, city: e.target.value })} placeholder="Dubai" className="text-xs h-7" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Stars</label>
          <Input type="number" min={1} max={5} value={hotel.rating ?? ''} onChange={(e) => onUpdate({ ...hotel, rating: Number(e.target.value) })} placeholder="4" className="text-xs h-7" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Rooms</label>
          <Input type="number" min={1} value={hotel.roomCount ?? 1} onChange={(e) => onUpdate({ ...hotel, roomCount: Number(e.target.value) })} className="text-xs h-7" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Check-in</label>
          <Input type="date" value={hotel.checkIn ?? ''} onChange={(e) => onUpdate({ ...hotel, checkIn: e.target.value })} className="text-xs h-7" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Check-out</label>
          <Input type="date" value={hotel.checkOut ?? ''} onChange={(e) => onUpdate({ ...hotel, checkOut: e.target.value })} className="text-xs h-7" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Nights</label>
          <Input type="number" min={1} value={hotel.nights ?? ''} onChange={(e) => onUpdate({ ...hotel, nights: Number(e.target.value) })} placeholder="1" className="text-xs h-7" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[10px] text-muted-foreground">
          AED {pricePerNight.toLocaleString()}/night × {nights}N × {rooms} room{rooms > 1 ? 's' : ''}
        </span>
        <div className="text-right">
          <span className="text-xs font-semibold text-primary">AED {total.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">(AED {perPerson}/pax)</span>
        </div>
      </div>
    </div>
  );
}

// ── Service editor ────────────────────────────────────────────────────────────

const SERVICE_TYPES = ['transfer', 'tour', 'activity', 'visa', 'meal', 'other'];

function ServiceEditor({
  service, pax, primaryCity, onUpdate, onRemove,
}: {
  service: ExtractedService;
  pax: number;
  primaryCity: string;
  onUpdate: (s: ExtractedService) => void;
  onRemove: () => void;
}) {
  const pricing = calcServicePrice(service, pax);
  const currency = service.currency ?? 'AED';

  return (
    <div className="rounded-lg border border-secondary/30 bg-secondary/[0.04] p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <ServiceSearchInput
            value={service.name ?? ''}
            destination={primaryCity}
            onValueChange={(v) => onUpdate({ ...service, name: v })}
            onSelect={(s) => onUpdate({
              ...service,
              name: s.name,
              serviceType: s.serviceType ?? service.serviceType,
              basePricePerUnit: s.defaultSellPrice ?? s.basePrice ?? service.basePricePerUnit,
              currency: s.currency ?? service.currency ?? 'AED',
              pricingType: s.serviceType?.toLowerCase().includes('shared') ? 'SHARED' : (service.pricingType ?? 'PRIVATE'),
            })}
          />
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-danger shrink-0">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground">Type</label>
          <select
            value={service.serviceType ?? 'other'}
            onChange={(e) => onUpdate({ ...service, serviceType: e.target.value })}
            className="w-full h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Pricing</label>
          <select
            value={service.pricingType ?? 'PRIVATE'}
            onChange={(e) => onUpdate({ ...service, pricingType: e.target.value as 'PRIVATE' | 'SHARED' })}
            className="w-full h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
          >
            <option value="PRIVATE">PRIVATE</option>
            <option value="SHARED">SHARED</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">
            {service.pricingType === 'SHARED' ? 'Capacity' : 'Per unit'}
          </label>
          {service.pricingType === 'SHARED' ? (
            <Input type="number" min={1} value={service.capacity ?? ''} onChange={(e) => onUpdate({ ...service, capacity: Number(e.target.value) })} placeholder="4" className="text-xs h-7" />
          ) : (
            <div className="text-[10px] text-muted-foreground pt-1">per person</div>
          )}
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-muted-foreground">Base price per unit ({currency})</label>
          <Input type="number" min={0} value={service.basePricePerUnit ?? ''} onChange={(e) => onUpdate({ ...service, basePricePerUnit: Number(e.target.value) })} placeholder="500" className="text-xs h-7" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Currency</label>
          <select
            value={service.currency ?? 'AED'}
            onChange={(e) => onUpdate({ ...service, currency: e.target.value })}
            className="w-full h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
          >
            {['AED', 'USD', 'EUR', 'GBP', 'INR'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Date (optional)</label>
          <Input type="date" value={service.date ?? ''} onChange={(e) => onUpdate({ ...service, date: e.target.value })} className="text-xs h-7" />
        </div>
      </div>
      {pricing && (
        <div className="flex items-center justify-between pt-0.5">
          <span className={cn('text-[10px] font-medium', service.pricingType === 'SHARED' ? 'text-info' : 'text-warning')}>
            {service.pricingType === 'SHARED'
              ? `SHARED · ${Math.ceil(pax / (service.capacity ?? 1))} unit(s) × ${currency} ${service.basePricePerUnit ?? 0}`
              : `PRIVATE · ${currency} ${service.basePricePerUnit ?? 0} × ${pax} pax`}
          </span>
          <div className="text-right">
            <span className="text-xs font-semibold text-primary">{currency} {pricing.total.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">({currency} {Math.round(pricing.pricePerPerson)}/pax)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hotel autocomplete input ──────────────────────────────────────────────────

function HotelSearchInput({
  value, city, onValueChange, onSelect,
}: {
  value: string;
  city?: string;
  onValueChange: (v: string) => void;
  onSelect: (h: Hotel) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQ(value); }, [value]);

  const { data } = useQuery({
    queryKey: ['hotels', 'search', q, city],
    queryFn: () => hotelsService.search({ search: q, city, limit: 6 }),
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
        placeholder="Search or type hotel name…"
        className="text-xs h-7"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-lg border border-border bg-card shadow-xl max-h-48 overflow-y-auto">
          {results.map((h) => (
            <button
              key={h.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
              onMouseDown={() => { onSelect(h); setQ(h.name); setOpen(false); }}
            >
              <Building2 className="size-3 shrink-0 text-muted-foreground" />
              <span className="flex-1 font-medium">{h.name}</span>
              <span className="text-muted-foreground shrink-0">{'★'.repeat(h.starRating)} {h.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Service autocomplete input ────────────────────────────────────────────────

function ServiceSearchInput({
  value, destination, onValueChange, onSelect,
}: {
  value: string;
  destination: string;
  onValueChange: (v: string) => void;
  onSelect: (s: Service) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQ(value); }, [value]);

  const { data } = useQuery({
    queryKey: ['services', 'search', q, destination],
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
        placeholder="Search or type service name…"
        className="text-xs h-7"
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
              <span className="text-muted-foreground shrink-0">
                {s.currency} {(s.defaultSellPrice ?? s.basePrice ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({
  icon: Icon, label, children, action,
}: {
  icon: React.ElementType | null;
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {Icon && <Icon className="size-3.5" />}
          {label}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, required, highlight, children,
}: {
  label: string; required?: boolean; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className={cn('text-xs font-medium', highlight ? 'text-primary' : 'text-muted-foreground')}>
        {label}{required && <span className="ml-0.5 text-danger">*</span>}
        {highlight && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />}
      </span>
      {children}
    </label>
  );
}

function LocationsEditor({
  locations, onChange,
}: {
  locations: LeadLocation[];
  onChange: (locs: LeadLocation[]) => void;
}) {
  const [newCity, setNewCity] = useState('');
  const [newNights, setNewNights] = useState('');

  const add = () => {
    if (!newCity.trim()) return;
    onChange([...locations, { locationId: uuid(), city: newCity.trim(), hotels: [], nights: newNights ? Number(newNights) : undefined }]);
    setNewCity(''); setNewNights('');
  };

  return (
    <div className="space-y-2">
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {locations.map((loc, i) => (
            <span key={loc.locationId} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs">
              <MapPin className="size-3 text-primary" />
              <span className="font-medium">{i + 1}. {loc.city}</span>
              {loc.nights && <span className="text-muted-foreground">· {loc.nights}N</span>}
              <button onClick={() => onChange(locations.filter((l) => l.locationId !== loc.locationId))} className="ml-1 text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input placeholder="City / destination" value={newCity} onChange={(e) => setNewCity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className="flex-1" />
        <Input type="number" placeholder="Nights" value={newNights} onChange={(e) => setNewNights(e.target.value)} className="w-20" />
        <Button size="sm" variant="secondary" onClick={add} disabled={!newCity.trim()}><Plus className="size-3.5" /></Button>
      </div>
    </div>
  );
}
