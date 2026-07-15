import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  DollarSign,
  Hotel,
  Mail,
  MapPin,
  MoreHorizontal,
  Plane,
  Phone,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User2,
  Users,
  X,
} from 'lucide-react';
import { Drawer } from '@shared/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Button } from '@shared/components/ui/button';
import { StatusBadge } from '@shared/components/ui/badge';
import { Avatar } from '@shared/components/ui/avatar';
import { Select } from '@shared/components/ui/select';
import { Input } from '@shared/components/ui/input';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Timeline } from '@shared/components/data/timeline';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '@shared/components/ui/dropdown';
import { useLead, useLeadActivities } from '@shared/queries/leads.queries';
import { useProposals } from '@shared/queries/proposals.queries';
import { useFollowups } from '@shared/queries/followups.queries';
import { useFulfillments } from '@shared/queries/fulfillments.queries';
import { useUpdateLead, useDeleteLead } from '@shared/mutations/leads.mutations';
import {
  useAcceptProposal,
  useCreateProposal,
  useRejectProposal,
  useSendProposal,
} from '@shared/mutations/proposals.mutations';
import { useCreateFollowup, useUpdateFollowup } from '@shared/mutations/followups.mutations';
import { useUpdateFulfillment } from '@shared/mutations/fulfillments.mutations';
import { LeadOverviewTab } from './LeadOverviewTab';
import { leadDisplayName } from './lead-display';
import { useLeadChat } from '@shared/mutations/ai.mutations';
import {
  FlightClass,
  FlightType,
  FulfillmentStatus,
  LeadStatus,
  ProposalType,
  TravelerType,
  type Fulfillment,
  type FollowUp,
  type Lead,
  type LeadFlight,
  type LeadHotel,
  type LeadLocation,
  type LeadTraveler,
  type Proposal,
} from '@shared/types/domain';
import { formatCurrency, formatDate, formatRelative, titleCase } from '@shared/lib/format';
import { fulfillmentTone, leadTone, proposalTone } from '@shared/lib/status';
import { useUiStore } from '@shared/stores/ui.store';
import { useAuthStore } from '@shared/stores/auth.store';
import { cn } from '@shared/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const open = Boolean(leadId);
  const { data: lead, isLoading } = useLead(leadId ?? undefined);

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={isLoading ? 'Loading…' : lead ? leadDisplayName(lead) : 'Lead'}
      header={lead && <LeadHeader lead={lead} />}
    >
      {isLoading || !lead ? (
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <LeadDrawerBody lead={lead} onClose={onClose} />
      )}
    </Drawer>
  );
}

function LeadHeader({ lead }: { lead: Lead }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <StatusBadge status={lead.status} tone={leadTone(lead.status)} />
      <span>·</span>
      <span>{titleCase(lead.inquiryType)}</span>
      {lead.companyName && (
        <>
          <span>·</span>
          <span>{lead.companyName}</span>
        </>
      )}
    </div>
  );
}

function LeadDrawerBody({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const canDelete = useAuthStore((s) => s.hasPermission('lead.delete'));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <LeadAiContextBridge lead={lead} />
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <Avatar name={leadDisplayName(lead)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {lead.email}
              </a>
            )}
          </div>
        </div>
        <div className="w-40">
          <Select
            value={lead.status}
            options={LeadStatus.map((s) => ({ label: titleCase(s), value: s }))}
            onChange={(e) =>
              updateLead.mutate({ id: lead.id, input: { status: e.target.value as LeadStatus } })
            }
          />
        </div>
        {/* Delete is a manager-level action — hidden for staff without lead.delete. */}
        {canDelete && (
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete lead
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
      </div>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <div className="px-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="itinerary">
              <MapPin className="size-3.5" /> Itinerary
            </TabsTrigger>
            <TabsTrigger value="travelers">
              <Users className="size-3.5" /> Travelers
            </TabsTrigger>
            <TabsTrigger value="ai-chat">
              <Bot className="size-3.5" /> AI
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {/* Proposal & follow-up workflows are deferred — kept in code, disabled for now. */}
            <TabsTrigger value="proposals" disabled title="Coming soon">
              Proposals · Soon
            </TabsTrigger>
            <TabsTrigger value="followups" disabled title="Coming soon">
              Follow-ups · Soon
            </TabsTrigger>
            <TabsTrigger value="fulfillments">Fulfillments</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="overview">
            <LeadOverviewTab lead={lead} />
          </TabsContent>
          <TabsContent value="itinerary">
            <ItineraryTab lead={lead} />
          </TabsContent>
          <TabsContent value="travelers">
            <TravelersTab lead={lead} />
          </TabsContent>
          <TabsContent value="ai-chat">
            <LeadAiChatTab lead={lead} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab leadId={lead.id} />
          </TabsContent>
          <TabsContent value="proposals">
            <ProposalsTab lead={lead} />
          </TabsContent>
          <TabsContent value="followups">
            <FollowupsTab leadId={lead.id} />
          </TabsContent>
          <TabsContent value="fulfillments">
            <FulfillmentsTab leadId={lead.id} />
          </TabsContent>
        </div>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this lead?"
        description="It will be soft-deleted. Related proposals and fulfillments are preserved."
        destructive
        confirmLabel="Delete"
        loading={deleteLead.isPending}
        onConfirm={() =>
          deleteLead.mutate(lead.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </div>
  );
}


// ── Itinerary (Locations + Hotels per location) ────────────────────────────────

// Auto-price a hotel based on star rating (deterministic via name hash)
function autoPricePerNight(hotelName: string, rating?: number): number {
  const seed = hotelName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = ((seed * 9301 + 49297) % 233280) / 233280; // 0–1 pseudo-random
  if ((rating ?? 0) >= 5) return Math.round(220 + rand * 180); // $220–$400
  if ((rating ?? 0) >= 4) return Math.round(130 + rand * 100); // $130–$230
  if ((rating ?? 0) >= 3) return Math.round(70 + rand * 60);   // $70–$130
  return Math.round(100 + rand * 80); // default $100–$180
}

function nightsBetween(checkIn?: string, checkOut?: string): number | undefined {
  if (!checkIn || !checkOut) return undefined;
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000;
  return diff > 0 ? Math.round(diff) : undefined;
}

function ItineraryTab({ lead }: { lead: Lead }) {
  const update = useUpdateLead();
  const [locations, setLocations] = useState<LeadLocation[]>(lead.locations ?? []);
  const [flights, setFlights] = useState<LeadFlight[]>(lead.flights ?? []);
  const [startDate, setStartDate] = useState(lead.startDate ?? '');
  const [endDate, setEndDate] = useState(lead.endDate ?? '');

  useEffect(() => { setLocations(lead.locations ?? []); }, [lead.locations]);
  useEffect(() => { setFlights(lead.flights ?? []); }, [lead.flights]);
  useEffect(() => { setStartDate(lead.startDate ?? ''); }, [lead.startDate]);
  useEffect(() => { setEndDate(lead.endDate ?? ''); }, [lead.endDate]);

  const saveLocations = (next: LeadLocation[]) => {
    setLocations(next);
    update.mutate({ id: lead.id, input: { locations: next as never } });
  };
  const saveFlights = (next: LeadFlight[]) => {
    setFlights(next);
    update.mutate({ id: lead.id, input: { flights: next as never } });
  };
  const saveDates = (patch: { startDate?: string; endDate?: string }) =>
    update.mutate({ id: lead.id, input: patch });

  const addLocation = () =>
    saveLocations([...locations, { locationId: uuid(), city: '', country: '', hotels: [] }]);

  const removeLocation = (id: string) =>
    saveLocations(locations.filter((l) => l.locationId !== id));

  const updateLocation = (id: string, patch: Partial<LeadLocation>) =>
    saveLocations(locations.map((l) => (l.locationId === id ? { ...l, ...patch } : l)));

  const addFlight = () =>
    saveFlights([...flights, { flightId: uuid(), type: 'OUTBOUND', flightClass: 'ECONOMY' }]);

  const removeFlight = (id: string) =>
    saveFlights(flights.filter((f) => f.flightId !== id));

  const updateFlight = (id: string, patch: Partial<LeadFlight>) =>
    saveFlights(flights.map((f) => (f.flightId === id ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-5">
      {/* Trip dates */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trip dates</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Start date</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                saveDates({ startDate: e.target.value });
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">End date</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                saveDates({ endDate: e.target.value });
              }}
            />
          </label>
        </div>
        {startDate && endDate && new Date(endDate) > new Date(startDate) && (
          <p className="text-xs text-muted-foreground">
            {Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000)} nights total
          </p>
        )}
      </div>

      {/* Locations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            <MapPin className="mr-1 inline size-3.5 text-muted-foreground" />
            Locations ({locations.length})
          </p>
          <Button size="sm" variant="secondary" onClick={addLocation}>
            <Plus className="size-3.5" /> Add location
          </Button>
        </div>
        {locations.length === 0 && (
          <EmptyState icon={MapPin} title="No locations yet" description="Add destinations to build the itinerary." />
        )}
        {locations.map((loc, idx) => (
          <LocationCard
            key={loc.locationId}
            loc={loc}
            index={idx}
            onUpdate={(patch) => updateLocation(loc.locationId, patch)}
            onRemove={() => removeLocation(loc.locationId)}
          />
        ))}
      </div>

      {/* Flights */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            <Plane className="mr-1 inline size-3.5 text-muted-foreground" />
            Flights ({flights.length})
          </p>
          <Button size="sm" variant="secondary" onClick={addFlight}>
            <Plus className="size-3.5" /> Add flight
          </Button>
        </div>
        {flights.length === 0 && (
          <EmptyState icon={Plane} title="No flights yet" description="Add outbound, inbound, or internal flights." />
        )}
        {flights.map((fl) => (
          <FlightCard
            key={fl.flightId}
            flight={fl}
            travelerCount={lead.travelers?.length || 1}
            onUpdate={(patch) => updateFlight(fl.flightId, patch)}
            onRemove={() => removeFlight(fl.flightId)}
          />
        ))}
      </div>
    </div>
  );
}

const MEAL_PLANS = ['BB', 'HB', 'FB', 'AI', 'RO'];
const CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'SAR', 'INR'];

function LocationCard({
  loc,
  index,
  onUpdate,
  onRemove,
}: {
  loc: LeadLocation;
  index: number;
  onUpdate: (patch: Partial<LeadLocation>) => void;
  onRemove: () => void;
}) {
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [newHotel, setNewHotel] = useState<Partial<LeadHotel>>({ currency: 'USD', roomCount: 1 });

  const commitHotel = () => {
    if (!newHotel.hotelName?.trim()) return;
    const nights = nightsBetween(newHotel.checkIn, newHotel.checkOut) ?? newHotel.nights;
    const ppn = newHotel.pricePerNight ?? autoPricePerNight(newHotel.hotelName, newHotel.rating);
    const rooms = newHotel.roomCount ?? 1;
    const hotel: LeadHotel = {
      hotelName: newHotel.hotelName.trim(),
      roomType: newHotel.roomType?.trim() || undefined,
      mealPlan: newHotel.mealPlan?.trim() || undefined,
      checkIn: newHotel.checkIn || undefined,
      checkOut: newHotel.checkOut || undefined,
      nights,
      roomCount: rooms,
      rating: newHotel.rating,
      pricePerNight: ppn,
      totalPrice: nights ? ppn * nights * rooms : undefined,
      currency: newHotel.currency ?? 'USD',
      notes: newHotel.notes?.trim() || undefined,
    };
    onUpdate({ hotels: [...(loc.hotels ?? []), hotel] });
    setNewHotel({ currency: 'USD', roomCount: 1 });
    setShowHotelForm(false);
  };

  const removeHotel = (i: number) =>
    onUpdate({ hotels: loc.hotels.filter((_, idx) => idx !== i) });

  const updateHotel = (i: number, patch: Partial<LeadHotel>) => {
    const next = loc.hotels.map((h, idx) => {
      if (idx !== i) return h;
      const merged = { ...h, ...patch };
      const nights = nightsBetween(merged.checkIn, merged.checkOut) ?? merged.nights;
      const ppn = merged.pricePerNight ?? autoPricePerNight(merged.hotelName, merged.rating);
      const rooms = merged.roomCount ?? 1;
      return { ...merged, nights, totalPrice: nights ? ppn * nights * rooms : merged.totalPrice };
    });
    onUpdate({ hotels: next });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      {/* Location header */}
      <div className="flex items-center gap-2 border-b border-border p-3">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {index + 1}
        </span>
        <MapPin className="size-4 text-muted-foreground" />
        <Input
          value={loc.city}
          onChange={(e) => onUpdate({ city: e.target.value })}
          placeholder="City"
          className="h-7 flex-1 border-none bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
        />
        <Input
          value={loc.country ?? ''}
          onChange={(e) => onUpdate({ country: e.target.value })}
          placeholder="Country"
          className="h-7 w-20 border-none bg-transparent p-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <X className="size-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Location dates */}
      <div className="grid grid-cols-3 gap-2 border-b border-border px-3 py-2">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Check-in</span>
          <Input type="date" value={loc.checkIn ?? ''} onChange={(e) => onUpdate({ checkIn: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Check-out</span>
          <Input type="date" value={loc.checkOut ?? ''} onChange={(e) => {
            const co = e.target.value || undefined;
            onUpdate({ checkOut: co, nights: nightsBetween(loc.checkIn, co) });
          }} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Nights</span>
          <Input type="number" min={0} value={loc.nights ?? ''} onChange={(e) => onUpdate({ nights: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
        </label>
      </div>

      {/* Hotels */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Hotel className="size-3.5" /> Hotels ({loc.hotels?.length ?? 0})
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShowHotelForm((v) => !v)}>
            <Plus className="size-3.5" /> Hotel
          </Button>
        </div>

        {showHotelForm && (
          <div className="rounded-md border border-border bg-background p-3 space-y-2.5">
            <Input
              placeholder="Hotel name *"
              value={newHotel.hotelName ?? ''}
              onChange={(e) => setNewHotel((p) => ({ ...p, hotelName: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Check-in</span>
                <Input type="date" value={newHotel.checkIn ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, checkIn: e.target.value || undefined }))} className="h-7 text-xs" />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Check-out</span>
                <Input type="date" value={newHotel.checkOut ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, checkOut: e.target.value || undefined }))} className="h-7 text-xs" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Room type</span>
                <Input placeholder="e.g. Deluxe" value={newHotel.roomType ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, roomType: e.target.value }))} className="h-7 text-xs" />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Meal plan</span>
                <select value={newHotel.mealPlan ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, mealPlan: e.target.value }))} className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                  <option value="">-</option>
                  {MEAL_PLANS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Rooms</span>
                <Input type="number" min={1} value={newHotel.roomCount ?? 1} onChange={(e) => setNewHotel((p) => ({ ...p, roomCount: Number(e.target.value) }))} className="h-7 text-xs" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Stars</span>
                <Input type="number" min={1} max={5} placeholder="5" value={newHotel.rating ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, rating: e.target.value ? Number(e.target.value) : undefined }))} className="h-7 text-xs" />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Price/night</span>
                <Input type="number" min={0} placeholder="auto" value={newHotel.pricePerNight ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, pricePerNight: e.target.value ? Number(e.target.value) : undefined }))} className="h-7 text-xs" />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Currency</span>
                <select value={newHotel.currency ?? 'USD'} onChange={(e) => setNewHotel((p) => ({ ...p, currency: e.target.value }))} className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <Input placeholder="Notes" value={newHotel.notes ?? ''} onChange={(e) => setNewHotel((p) => ({ ...p, notes: e.target.value }))} className="h-7 text-xs" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowHotelForm(false)}>Cancel</Button>
              <Button size="sm" disabled={!newHotel.hotelName?.trim()} onClick={commitHotel}>Add hotel</Button>
            </div>
          </div>
        )}

        {loc.hotels?.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No hotels added for this location.</p>
        ) : (
          <div className="space-y-2">
            {loc.hotels?.map((h, i) => (
              <HotelRow key={i} hotel={h} onUpdate={(p) => updateHotel(i, p)} onRemove={() => removeHotel(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HotelRow({
  hotel,
  onUpdate,
  onRemove,
}: {
  hotel: LeadHotel;
  onUpdate: (patch: Partial<LeadHotel>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ppn = hotel.pricePerNight ?? autoPricePerNight(hotel.hotelName, hotel.rating);
  const rooms = hotel.roomCount ?? 1;
  const total = hotel.totalPrice ?? (hotel.nights ? ppn * hotel.nights * rooms : undefined);

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <Hotel className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{hotel.hotelName}</p>
          <p className="text-[11px] text-muted-foreground">
            {[
              hotel.checkIn && hotel.checkOut ? `${hotel.checkIn} → ${hotel.checkOut}` : hotel.nights ? `${hotel.nights}N` : null,
              hotel.roomType,
              hotel.mealPlan,
              hotel.rating ? `${hotel.rating}★` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        {total != null && (
          <span className="shrink-0 text-xs font-semibold text-primary">
            {hotel.currency ?? 'USD'} {total.toLocaleString()}
          </span>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((v) => !v)} aria-label="Edit">
          <DollarSign className="size-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <X className="size-3.5 text-muted-foreground" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Check-in</span>
              <Input type="date" value={hotel.checkIn ?? ''} onChange={(e) => onUpdate({ checkIn: e.target.value || undefined })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Check-out</span>
              <Input type="date" value={hotel.checkOut ?? ''} onChange={(e) => {
                const co = e.target.value || undefined;
                onUpdate({ checkOut: co, nights: nightsBetween(hotel.checkIn, co) });
              }} className="h-7 text-xs" />
            </label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Nights</span>
              <Input type="number" min={0} value={hotel.nights ?? ''} onChange={(e) => onUpdate({ nights: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Rooms</span>
              <Input type="number" min={1} value={hotel.roomCount ?? 1} onChange={(e) => onUpdate({ roomCount: Number(e.target.value) })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Stars</span>
              <Input type="number" min={1} max={5} value={hotel.rating ?? ''} onChange={(e) => onUpdate({ rating: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Meal plan</span>
              <select value={hotel.mealPlan ?? ''} onChange={(e) => onUpdate({ mealPlan: e.target.value || undefined })} className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                <option value="">-</option>
                {MEAL_PLANS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Price/night</span>
              <Input type="number" min={0} value={hotel.pricePerNight ?? ppn} onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                const n = hotel.nights ?? 0;
                onUpdate({ pricePerNight: v, totalPrice: v && n ? v * n * rooms : undefined });
              }} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Total price</span>
              <Input type="number" min={0} value={hotel.totalPrice ?? total ?? ''} onChange={(e) => onUpdate({ totalPrice: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Currency</span>
              <select value={hotel.currency ?? 'USD'} onChange={(e) => onUpdate({ currency: e.target.value })} className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Notes</span>
            <Input value={hotel.notes ?? ''} onChange={(e) => onUpdate({ notes: e.target.value || undefined })} className="h-7 text-xs" />
          </label>
          {/* Auto-price badge */}
          {!hotel.pricePerNight && (
            <p className="text-[10px] text-muted-foreground">
              * Price auto-estimated at {hotel.currency ?? 'USD'} {ppn}/night - update to set actual rate.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const FLIGHT_TYPES: { label: string; value: string }[] = FlightType.map((t) => ({ label: t.charAt(0) + t.slice(1).toLowerCase(), value: t }));
const FLIGHT_CLASSES: { label: string; value: string }[] = FlightClass.map((c) => ({ label: c.charAt(0) + c.slice(1).toLowerCase(), value: c }));

function FlightCard({
  flight,
  travelerCount,
  onUpdate,
  onRemove,
}: {
  flight: LeadFlight;
  travelerCount: number;
  onUpdate: (patch: Partial<LeadFlight>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Plane className="size-3.5 text-muted-foreground" />
        <select
          value={flight.type}
          onChange={(e) => onUpdate({ type: e.target.value as LeadFlight['type'] })}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold"
        >
          {FLIGHT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={flight.flightClass ?? 'ECONOMY'}
          onChange={(e) => onUpdate({ flightClass: e.target.value as LeadFlight['flightClass'] })}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {FLIGHT_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onRemove}>
          <X className="size-3.5 text-muted-foreground" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Airline</span>
          <Input placeholder="e.g. Emirates" value={flight.airline ?? ''} onChange={(e) => onUpdate({ airline: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Flight no.</span>
          <Input placeholder="e.g. EK203" value={flight.flightNo ?? ''} onChange={(e) => onUpdate({ flightNo: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">From</span>
          <Input placeholder="DXB / Dubai" value={flight.from ?? ''} onChange={(e) => onUpdate({ from: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">To</span>
          <Input placeholder="LHR / London" value={flight.to ?? ''} onChange={(e) => onUpdate({ to: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <label className="space-y-0.5 col-span-1">
          <span className="text-[10px] text-muted-foreground">Date</span>
          <Input type="date" value={flight.date ?? ''} onChange={(e) => onUpdate({ date: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Dep.</span>
          <Input type="time" value={flight.departureTime ?? ''} onChange={(e) => onUpdate({ departureTime: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Arr. date</span>
          <Input type="date" value={flight.arrivalDate ?? ''} onChange={(e) => onUpdate({ arrivalDate: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Arr.</span>
          <Input type="time" value={flight.arrivalTime ?? ''} onChange={(e) => onUpdate({ arrivalTime: e.target.value || undefined })} className="h-7 text-xs" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Price/person</span>
          <Input type="number" min={0} value={flight.pricePerPerson ?? ''} onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : undefined;
            onUpdate({ pricePerPerson: v, totalPrice: v ? v * travelerCount : undefined });
          }} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Total price</span>
          <Input type="number" min={0} value={flight.totalPrice ?? ''} onChange={(e) => onUpdate({ totalPrice: e.target.value ? Number(e.target.value) : undefined })} className="h-7 text-xs" />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Currency</span>
          <select value={flight.currency ?? 'USD'} onChange={(e) => onUpdate({ currency: e.target.value })} className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-0.5">
        <span className="text-[10px] text-muted-foreground">Notes</span>
        <Input placeholder="e.g. window seat preferred" value={flight.notes ?? ''} onChange={(e) => onUpdate({ notes: e.target.value || undefined })} className="h-7 text-xs" />
      </label>
    </div>
  );
}

// ── Travelers ─────────────────────────────────────────────────────────────────

function TravelersTab({ lead }: { lead: Lead }) {
  const update = useUpdateLead();
  const [travelers, setTravelers] = useState<LeadTraveler[]>(lead.travelers ?? []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<LeadTraveler>>({ type: 'ADULT' });

  useEffect(() => {
    setTravelers(lead.travelers ?? []);
  }, [lead.travelers]);

  const save = (next: LeadTraveler[]) => {
    setTravelers(next);
    update.mutate({ id: lead.id, input: { travelers: next as never } });
  };

  const addTraveler = () => {
    const t: LeadTraveler = {
      travelerId: uuid(),
      type: form.type ?? 'ADULT',
      firstName: form.firstName,
      lastName: form.lastName,
      nationality: form.nationality,
      passportNo: form.passportNo,
      dob: form.dob,
      notes: form.notes,
    };
    save([...travelers, t]);
    setForm({ type: 'ADULT' });
    setShowForm(false);
  };

  const removeTraveler = (travelerId: string) =>
    save(travelers.filter((t) => t.travelerId !== travelerId));

  const adults = travelers.filter((t) => t.type === 'ADULT').length;
  const children = travelers.filter((t) => t.type === 'CHILD').length;
  const infants = travelers.filter((t) => t.type === 'INFANT').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {travelers.length} traveler{travelers.length !== 1 ? 's' : ''}
          </p>
          {travelers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {adults > 0 && `${adults} adult${adults !== 1 ? 's' : ''}`}
              {children > 0 && ` · ${children} child${children !== 1 ? 'ren' : ''}`}
              {infants > 0 && ` · ${infants} infant${infants !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" /> Add traveler
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="First name"
              value={form.firstName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <Input
              placeholder="Last name"
              value={form.lastName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
            <Select
              value={form.type ?? 'ADULT'}
              options={TravelerType.map((t) => ({ label: titleCase(t), value: t }))}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as never }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Nationality"
              value={form.nationality ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
            />
            <Input
              placeholder="Passport no."
              value={form.passportNo ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, passportNo: e.target.value }))}
            />
            <Input
              type="date"
              placeholder="Date of birth"
              value={form.dob ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={addTraveler}>
              Add
            </Button>
          </div>
        </div>
      )}

      {travelers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No travelers yet"
          description="Add passengers for this trip."
        />
      ) : (
        <ul className="space-y-2">
          {travelers.map((t) => (
            <li
              key={t.travelerId}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <User2 className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {[t.firstName, t.lastName].filter(Boolean).join(' ') || 'Unnamed traveler'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    titleCase(t.type),
                    t.nationality,
                    t.passportNo,
                    t.dob ? `DOB: ${t.dob}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeTraveler(t.travelerId)}
                aria-label="Remove traveler"
              >
                <X className="size-3.5 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Lead AI Chat ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function LeadAiChatTab({ lead }: { lead: Lead }) {
  const chat = useLeadChat();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const proposals = useProposals({ leadId: lead.id, limit: 50 }).data;
  const followups = useFollowups({ leadId: lead.id, limit: 50 }).data;
  const fulfillments = useFulfillments({ leadId: lead.id, limit: 50 }).data;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, chat.isPending]);

  const context = buildLeadAiContext(
    lead,
    proposals?.items ?? [],
    followups?.items ?? [],
    fulfillments?.items ?? [],
  );

  const send = () => {
    if (!input.trim() || chat.isPending) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');

    chat.mutate(
      { message: userMsg.content, history: history, context },
      {
        onSuccess: (data) => {
          setHistory((h) => [...h, { role: 'assistant', content: data.reply }]);
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col" style={{ minHeight: 400 }}>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-2">
        <Bot className="size-4 text-primary" />
        <p className="text-xs text-muted-foreground">
          AI assistant with full knowledge of this lead's itinerary, travelers, and history.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {history.length === 0 && (
          <div className="space-y-2 pt-4">
            {[
              'Suggest hotels for each location in this itinerary',
              'Draft a WhatsApp message to follow up with this client',
              'What visa does this traveler likely need?',
              'Build a rough quote based on the current itinerary',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {history.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm border border-border bg-muted/50 text-foreground',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border bg-muted/50 px-4 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this lead…"
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
        />
        <Button onClick={send} disabled={!input.trim() || chat.isPending} size="icon-sm">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function TimelineTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useLeadActivities(leadId);
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0)
    return <EmptyState title="No activity yet" description="Actions on this lead will appear here." />;
  return <Timeline activities={data} />;
}

// ── Proposals ────────────────────────────────────────────────────────────────

function ProposalsTab({ lead }: { lead: Lead }) {
  const { data, isLoading } = useProposals({ leadId: lead.id, limit: 50 });
  const create = useCreateProposal();
  const send = useSendProposal();
  const accept = useAcceptProposal();
  const reject = useRejectProposal();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProposalType>('VISA');
  const [amount, setAmount] = useState('');

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Proposals ({items.length})</p>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" /> New
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <Input placeholder="Proposal title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as ProposalType)}
              options={ProposalType.map((t) => ({ label: titleCase(t), value: t }))}
            />
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={title.trim().length < 2}
              onClick={() =>
                create.mutate(
                  {
                    leadId: lead.id,
                    title,
                    proposalType: type,
                    amount: amount ? Number(amount) : undefined,
                  },
                  {
                    onSuccess: () => {
                      setShowForm(false);
                      setTitle('');
                      setAmount('');
                    },
                  },
                )
              }
            >
              Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={Send} title="No proposals" description="Create the first proposal for this lead." />
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.generatedToken}</p>
                </div>
                <StatusBadge status={p.status} tone={proposalTone(p.status)} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(p.amount, p.currency)}
                </span>
                <div className="flex gap-1">
                  {p.status === 'DRAFT' && (
                    <Button size="sm" variant="ghost" loading={send.isPending} onClick={() => send.mutate(p.id)}>
                      <Send className="size-3.5" /> Send
                    </Button>
                  )}
                  {(p.status === 'SENT' || p.status === 'VIEWED') && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => accept.mutate(p.id)}>
                        <ThumbsUp className="size-3.5 text-success" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reject.mutate({ id: p.id })}>
                        <ThumbsDown className="size-3.5 text-danger" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

function FollowupsTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useFollowups({ leadId, limit: 50 });
  const create = useCreateFollowup();
  const update = useUpdateFollowup();
  const [date, setDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm font-medium text-foreground">Schedule follow-up</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!date}
            onClick={() =>
              create.mutate(
                { leadId, scheduledDate: new Date(date).toISOString(), remarks: remarks || undefined },
                { onSuccess: () => { setDate(''); setRemarks(''); } },
              )
            }
          >
            Schedule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title="No follow-ups" />
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{f.remarks ?? 'Follow-up'}</p>
                <p className="text-xs text-muted-foreground">{formatRelative(f.scheduledDate)}</p>
              </div>
              {f.completedAt ? (
                <StatusBadge status={f.outcome ?? 'DONE'} tone="success" />
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={update.isPending}
                  onClick={() => update.mutate({ id: f.id, input: { outcome: 'POSITIVE' } })}
                >
                  <CheckCircle2 className="size-3.5" /> Complete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Fulfillments ──────────────────────────────────────────────────────────────

function FulfillmentsTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useFulfillments({ leadId, limit: 50 });
  const update = useUpdateFulfillment();
  const items = data?.items ?? [];

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (items.length === 0)
    return <EmptyState title="No fulfillments" description="A fulfillment opens when a proposal is accepted." />;

  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{titleCase(f.type)}</p>
            <p className="text-xs text-muted-foreground">Due {formatDate(f.dueDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={f.status} tone={fulfillmentTone(f.status)} />
            <Select
              className="w-40"
              value={f.status}
              options={FulfillmentStatus.map((s) => ({ label: titleCase(s), value: s }))}
              onChange={(e) =>
                update.mutate({ id: f.id, input: { status: e.target.value as never } })
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── AI context bridge ────────────────────────────────────────────────────────

function LeadAiContextBridge({ lead }: { lead: Lead }) {
  const setAiContext = useUiStore((s) => s.setAiContext);
  const proposals = useProposals({ leadId: lead.id, limit: 50 }).data;
  const followups = useFollowups({ leadId: lead.id, limit: 50 }).data;
  const fulfillments = useFulfillments({ leadId: lead.id, limit: 50 }).data;

  useEffect(() => {
    setAiContext({
      label: lead.companyName ? `${lead.name} · ${lead.companyName}` : lead.name,
      entity: { type: 'lead', id: lead.id },
      text: buildLeadAiContext(
        lead,
        proposals?.items ?? [],
        followups?.items ?? [],
        fulfillments?.items ?? [],
      ),
    });
  }, [lead, proposals, followups, fulfillments, setAiContext]);

  useEffect(() => () => setAiContext(null), [setAiContext]);

  return null;
}

function buildLeadAiContext(
  lead: Lead,
  proposals: Proposal[],
  followups: FollowUp[],
  fulfillments: Fulfillment[],
): string {
  const lines: string[] = [];

  lines.push(`LEAD: ${lead.name}${lead.companyName ? ` (${lead.companyName})` : ''}`);
  lines.push(`- Contact: ${lead.phone}${lead.email ? ` / ${lead.email}` : ''}`);
  lines.push(
    `- Inquiry: ${lead.inquiryType} · Source: ${lead.source} · Status: ${lead.status}`,
  );
  lines.push(`- Created: ${formatDate(lead.createdAt)}`);
  if (lead.rawInquiry) lines.push(`- Original message: "${lead.rawInquiry}"`);
  if (lead.notes) lines.push(`- Notes: ${lead.notes}`);

  if (lead.travelers?.length) {
    lines.push('', `TRAVELERS (${lead.travelers.length}):`);
    lead.travelers.forEach((t) =>
      lines.push(
        `- ${[t.firstName, t.lastName].filter(Boolean).join(' ') || 'Unnamed'} [${t.type}]` +
          `${t.nationality ? ` · ${t.nationality}` : ''}` +
          `${t.passportNo ? ` · Passport: ${t.passportNo}` : ''}`,
      ),
    );
  }

  if (lead.locations?.length) {
    lines.push('', `ITINERARY (${lead.locations.length} location${lead.locations.length !== 1 ? 's' : ''}):`);
    lead.locations.forEach((loc, i) => {
      lines.push(
        `- Location ${i + 1}: ${loc.city}${loc.country ? `, ${loc.country}` : ''}` +
          `${loc.nights ? ` · ${loc.nights} nights` : ''}` +
          `${loc.checkIn ? ` · ${loc.checkIn}` : ''}`,
      );
      loc.hotels?.forEach((h) =>
        lines.push(
          `  Hotel: ${h.hotelName}` +
            `${h.roomType ? ` · ${h.roomType}` : ''}` +
            `${h.mealPlan ? ` · ${h.mealPlan}` : ''}` +
            `${h.nights ? ` · ${h.nights}N` : ''}`,
        ),
      );
    });
  }

  lines.push('', `PROPOSALS (${proposals.length}):`);
  if (proposals.length === 0) lines.push('- none yet');
  proposals.forEach((p) =>
    lines.push(
      `- ${p.generatedToken} "${p.title}" · ${p.proposalType} · ` +
        `${formatCurrency(p.amount, p.currency)} · ${p.status}`,
    ),
  );

  lines.push('', `FOLLOW-UPS (${followups.length}):`);
  if (followups.length === 0) lines.push('- none yet');
  followups.forEach((f) =>
    lines.push(
      `- ${formatDate(f.scheduledDate)} · ${f.completedAt ? `done (${f.outcome ?? '-'})` : 'pending'}` +
        `${f.remarks ? ` · ${f.remarks}` : ''}`,
    ),
  );

  lines.push('', `FULFILLMENTS (${fulfillments.length}):`);
  if (fulfillments.length === 0) lines.push('- none yet');
  fulfillments.forEach((ff) =>
    lines.push(
      `- ${ff.type} · ${ff.status}${ff.dueDate ? ` · due ${formatDate(ff.dueDate)}` : ''}`,
    ),
  );

  return lines.join('\n');
}
