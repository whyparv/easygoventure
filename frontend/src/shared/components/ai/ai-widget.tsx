import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, SendHorizonal, Sparkles, UserPlus, Wand2, X } from 'lucide-react';
import { Drawer } from '@shared/components/ui/drawer';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Textarea } from '@shared/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Badge } from '@shared/components/ui/badge';
import { useUiStore } from '@shared/stores/ui.store';
import { useAiChat, useParseInquiry } from '@shared/mutations/ai.mutations';
import { useCreateLead } from '@shared/mutations/leads.mutations';
import type { ChatTurn } from '@shared/services/ai.service';
import type { ParsedInquiry } from '@shared/types/domain';
import { serviceToInquiryType } from '@shared/lib/inquiry';
import { ROUTES } from '@app/config/routes';

export function AIWidget() {
  const open = useUiStore((s) => s.aiOpen);
  const setOpen = useUiStore((s) => s.setAiOpen);

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      widthClass="w-full sm:w-[440px]"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> AI Assistant
        </span>
      }
      description="Context-aware help powered by your backend AI service"
    >
      <div className="flex h-full flex-col p-5">
        <Tabs defaultValue="assistant" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="assistant">Assistant</TabsTrigger>
            <TabsTrigger value="parse">Paste Enquiry</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 pt-4">
            <TabsContent value="assistant" className="h-full">
              <ChatPanel />
            </TabsContent>
            <TabsContent value="parse" className="h-full">
              <PasteEnquiryPanel onClose={() => setOpen(false)} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Drawer>
  );
}

const GENERIC_SUGGESTIONS = [
  'What documents are needed for a Dubai tourist visa?',
  'Suggest a 5-day Dubai itinerary for a family of 4.',
  'Draft a WhatsApp reply asking for passport copies and travel dates.',
  'What should I include in a Thailand honeymoon package?',
];

const RECORD_SUGGESTIONS = [
  'Summarise this lead and where the deal stands.',
  'Draft a WhatsApp follow-up for this lead.',
  'Any risks or missing info I should chase on this deal?',
  'Suggest one 4-star and one 5-star hotel for this trip.',
];

function ChatPanel() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const chat = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiContext = useUiStore((s) => s.aiContext);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || chat.isPending) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    chat.mutate(
      { message, history, context: aiContext?.text },
      {
        onSuccess: (data) =>
          setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]),
        onError: () =>
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '⚠️ Sorry, I couldn’t reach the AI service. Please try again.' },
          ]),
      },
    );
  };

  const suggestions = aiContext ? RECORD_SUGGESTIONS : GENERIC_SUGGESTIONS;

  return (
    <div className="flex h-full flex-col">
      {aiContext && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-foreground">
            Answering about <span className="font-medium">{aiContext.label}</span>
          </span>
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && !chat.isPending && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              {aiContext
                ? 'Ask about the record you have open, or anything travel/DMC related.'
                : 'Ask about visas, itineraries, packages, transfers, tours - or get help drafting messages and quotations for your DMC enquiries.'}
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground'
                  : 'max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground'
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
      </div>


      <form
        className="mt-3 flex items-end gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask the DMC assistant…  (Enter to send)"
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-input bg-card p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <Button
          type="submit"
          size="icon"
          loading={chat.isPending}
          disabled={input.trim().length === 0}
          aria-label="Send"
        >
          <SendHorizonal />
        </Button>
      </form>
    </div>
  );
}

interface Draft {
  agencyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  destination: string;
  travelDate: string;
  returnDate: string;
  adults: string;
  children: string;
  rooms: string;
  services: string[];
  requestedHotels: string[];
  requirementsNote: string;
  service: string | null;
}

const str = (v?: string | null) => v ?? '';
const numStr = (v?: number | null) => (v == null ? '' : String(v));

function draftFromParsed(p: ParsedInquiry): Draft {
  return {
    agencyName: str(p.agencyName),
    contactPerson: str(p.customerName),
    phone: str(p.customerPhone),
    email: str(p.customerEmail),
    destination: str(p.destination),
    travelDate: str(p.travelDate),
    returnDate: str(p.returnDate),
    adults: numStr(p.adults ?? p.travelers),
    children: numStr(p.children),
    rooms: numStr(p.rooms),
    services: p.services ?? [],
    requestedHotels: p.requestedHotels ?? [],
    requirementsNote: str(p.requirementsNote),
    service: p.service,
  };
}

/**
 * Paste a raw enquiry → AI extracts structured fields → agent reviews/edits →
 * clicks Create Lead. The lead is NOT created automatically; on create it opens
 * in the Leads workspace so the agent can add services, hotels and pricing.
 */
function PasteEnquiryPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const parse = useParseInquiry();
  const createLead = useCreateLead();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const extract = () => {
    if (text.trim().length < 3) return;
    parse.mutate(text, {
      onSuccess: (p) => {
        setDraft(draftFromParsed(p));
        setConfidence(p.confidence);
        setMissing(p.missing ?? []);
      },
    });
  };

  const num = (v: string) => {
    const n = Number(v);
    return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
  };

  const createLeadFromDraft = () => {
    if (!draft) return;
    createLead.mutate(
      {
        name: draft.contactPerson.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        companyName: draft.agencyName.trim() || undefined,
        source: 'WHATSAPP',
        inquiryType: serviceToInquiryType(draft.service),
        destination: draft.destination.trim() || undefined,
        travelDate: draft.travelDate || undefined,
        returnDate: draft.returnDate || undefined,
        adults: num(draft.adults),
        children: num(draft.children),
        rooms: num(draft.rooms),
        // The inquiry becomes the working brief: store what the client REQUESTED.
        // Selected services/hotels are built by the agent in the lead detail.
        requestedServices: draft.services,
        requestedHotels: draft.requestedHotels,
        requirementsNote: draft.requirementsNote || undefined,
        rawInquiry: text || undefined,
      },
      {
        onSuccess: (lead) => {
          // Open the new lead so the agent continues into services → hotels → quote.
          navigate(`${ROUTES.leads}?lead=${lead.id}`);
          onClose();
          setText('');
          setDraft(null);
          setConfidence(null);
          setMissing([]);
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="text-sm text-muted-foreground">
          Paste a WhatsApp message or email. The assistant extracts the details — review, then create the lead.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={'Need Dubai package\n15–19 June\n2 adults\nVisa, Airport Transfer, Desert Safari'}
        />
        <Button
          className="w-full"
          variant={draft ? 'secondary' : 'primary'}
          loading={parse.isPending}
          disabled={text.trim().length < 3}
          onClick={extract}
        >
          <Wand2 /> {draft ? 'Re-extract' : 'Extract with AI'}
        </Button>

        {draft && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extracted — review &amp; edit
              </span>
              {confidence !== null && (
                <Badge tone={confidence >= 70 ? 'success' : confidence >= 40 ? 'warning' : 'danger'} dot>
                  {confidence}%
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DraftField label="Agency" value={draft.agencyName} onChange={(v) => set('agencyName', v)} />
              <DraftField label="Contact person" value={draft.contactPerson} onChange={(v) => set('contactPerson', v)} />
              <DraftField label="Phone" value={draft.phone} onChange={(v) => set('phone', v)} />
              <DraftField label="Destination" value={draft.destination} onChange={(v) => set('destination', v)} />
              <DraftField label="Travel date" type="date" value={draft.travelDate} onChange={(v) => set('travelDate', v)} />
              <DraftField label="Return date" type="date" value={draft.returnDate} onChange={(v) => set('returnDate', v)} />
              <DraftField label="Adults" type="number" value={draft.adults} onChange={(v) => set('adults', v)} />
              <DraftField label="Children" type="number" value={draft.children} onChange={(v) => set('children', v)} />
              <DraftField label="Rooms" type="number" value={draft.rooms} onChange={(v) => set('rooms', v)} />
            </div>

            <ChipEditor
              label="Requested services"
              items={draft.services}
              onRemove={(s) => set('services', draft.services.filter((x) => x !== s))}
              emptyHint="None detected."
            />
            <ChipEditor
              label="Requested hotels"
              items={draft.requestedHotels}
              onRemove={(h) => set('requestedHotels', draft.requestedHotels.filter((x) => x !== h))}
              emptyHint="None named."
            />

            {draft.requirementsNote && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Requirements brief</span>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-card p-2 font-sans text-xs leading-relaxed text-foreground">
                  {draft.requirementsNote}
                </pre>
              </div>
            )}

            {missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not detected: {missing.join(', ')} — optional, add later.
              </p>
            )}
          </div>
        )}
      </div>

      {draft && (
        <div className="mt-3 border-t border-border pt-3">
          <Button className="w-full" loading={createLead.isPending} onClick={createLeadFromDraft}>
            <UserPlus /> Create Lead <ArrowRight className="ml-auto" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ChipEditor({
  label,
  items,
  onRemove,
  emptyHint,
}: {
  label: string;
  items: string[];
  onRemove: (item: string) => void;
  emptyHint: string;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {s}
              <button type="button" onClick={() => onRemove(s)} aria-label={`Remove ${s}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftField({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
