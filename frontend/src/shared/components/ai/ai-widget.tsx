import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, SendHorizonal, Sparkles, Wand2, Zap } from 'lucide-react';
import { Drawer } from '@shared/components/ui/drawer';
import { Button } from '@shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Badge } from '@shared/components/ui/badge';
import { useUiStore } from '@shared/stores/ui.store';
import {
  useAiChat,
  useAiNextAction,
  useParseInquiry,
  useFollowupSuggestion,
} from '@shared/mutations/ai.mutations';
import { useCreateFollowup } from '@shared/mutations/followups.mutations';
import { useAddLeadActivity, useUpdateLead } from '@shared/mutations/leads.mutations';
import { useCreateProposal } from '@shared/mutations/proposals.mutations';
import type { ChatTurn, NextAction } from '@shared/services/ai.service';
import type { LeadStatus, ProposalType } from '@shared/types/domain';
import { formatCurrency, titleCase } from '@shared/lib/format';

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
            <TabsTrigger value="parse">Parse Inquiry</TabsTrigger>
            <TabsTrigger value="followup">Follow-up</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 pt-4">
            <TabsContent value="assistant" className="h-full">
              <ChatPanel />
            </TabsContent>
            <TabsContent value="parse">
              <ParseInquiryPanel />
            </TabsContent>
            <TabsContent value="followup">
              <FollowupPanel />
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
  'What is the best next action for this lead?',
  'Draft a WhatsApp follow-up for this lead.',
  'Any risks or missing info I should chase on this deal?',
];

function ChatPanel() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [action, setAction] = useState<NextAction | null>(null);
  const chat = useAiChat();
  const nextAction = useAiNextAction();
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiContext = useUiStore((s) => s.aiContext);
  const canAct = Boolean(aiContext?.entity);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending, action]);

  const suggestAction = () => {
    if (!aiContext || nextAction.isPending) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    nextAction.mutate(
      { context: aiContext.text, message: lastUser?.content },
      { onSuccess: setAction },
    );
  };

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
          {canAct && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              loading={nextAction.isPending}
              onClick={suggestAction}
            >
              <Zap /> Next action
            </Button>
          )}
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && !chat.isPending && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              {aiContext
                ? 'Ask about the record you have open, or anything travel/DMC related.'
                : 'Ask about visas, itineraries, packages, transfers, tours — or get help drafting messages and quotations for your DMC enquiries.'}
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

      {action && aiContext?.entity && (
        <ActionCard
          nextAction={action}
          leadId={aiContext.entity.id}
          onDismiss={() => setAction(null)}
          onApplied={(label) => {
            setAction(null);
            setMessages((prev) => [...prev, { role: 'assistant', content: `✅ Done — ${label}` }]);
          }}
        />
      )}

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

const ACTION_LABEL: Record<NextAction['action']['type'], string> = {
  create_followup: 'Schedule follow-up',
  add_note: 'Add note',
  update_status: 'Update status',
  create_proposal: 'Draft proposal',
  none: 'No action needed',
};

/** A confirmable, AI-recommended action executed via the existing CRM mutations. */
function ActionCard({
  nextAction,
  leadId,
  onDismiss,
  onApplied,
}: {
  nextAction: NextAction;
  leadId: string;
  onDismiss: () => void;
  onApplied: (label: string) => void;
}) {
  const { summary, action } = nextAction;
  const createFollowup = useCreateFollowup();
  const addNote = useAddLeadActivity();
  const updateLead = useUpdateLead();
  const createProposal = useCreateProposal();
  const executing =
    createFollowup.isPending ||
    addNote.isPending ||
    updateLead.isPending ||
    createProposal.isPending;

  const apply = () => {
    switch (action.type) {
      case 'create_followup':
        createFollowup.mutate(
          {
            leadId,
            scheduledDate: toIsoDate(action.scheduledDate),
            remarks: action.remarks,
            nextAction: action.nextAction,
          },
          { onSuccess: () => onApplied('follow-up scheduled') },
        );
        break;
      case 'add_note':
        if (!action.note) return;
        addNote.mutate(
          { id: leadId, input: { type: 'NOTE_ADDED', description: action.note } },
          { onSuccess: () => onApplied('note added') },
        );
        break;
      case 'update_status':
        if (!action.status) return;
        updateLead.mutate(
          { id: leadId, input: { status: action.status as LeadStatus } },
          { onSuccess: () => onApplied(`status set to ${titleCase(action.status as string)}`) },
        );
        break;
      case 'create_proposal':
        if (!action.title) return;
        createProposal.mutate(
          {
            leadId,
            title: action.title,
            proposalType: (action.proposalType ?? 'CUSTOM') as ProposalType,
            amount: action.amount,
            currency: action.currency,
            description: action.description,
          },
          { onSuccess: () => onApplied('proposal drafted') },
        );
        break;
    }
  };

  const actionable = action.type !== 'none';

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Zap className="size-4 text-primary" />
        {ACTION_LABEL[action.type]}
      </div>
      <p className="text-sm text-muted-foreground">{summary}</p>

      {actionable && (
        <div className="space-y-1 rounded-md border border-border bg-card px-3 py-2">
          {action.type === 'create_followup' && (
            <>
              <Field label="When" value={action.scheduledDate ?? null} />
              <Field label="Remarks" value={action.remarks ?? null} />
              <Field label="Next action" value={action.nextAction ?? null} />
            </>
          )}
          {action.type === 'add_note' && <Field label="Note" value={action.note ?? null} />}
          {action.type === 'update_status' && (
            <Field label="New status" value={action.status ? titleCase(action.status) : null} />
          )}
          {action.type === 'create_proposal' && (
            <>
              <Field label="Title" value={action.title ?? null} />
              <Field label="Type" value={action.proposalType ? titleCase(action.proposalType) : null} />
              <Field
                label="Amount"
                value={action.amount != null ? formatCurrency(action.amount, action.currency) : 'On request'}
              />
              <Field label="Details" value={action.description ?? null} />
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={executing}>
          Dismiss
        </Button>
        {actionable && (
          <Button size="sm" loading={executing} onClick={apply}>
            <CheckCircle2 /> {ACTION_LABEL[action.type]}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Normalize an AI date (YYYY-MM-DD or ISO) to a full ISO 8601 string. */
function toIsoDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const withTime = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T09:00:00` : value;
  const parsed = new Date(withTime);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function ParseInquiryPanel() {
  const [text, setText] = useState('');
  const parse = useParseInquiry();
  const result = parse.data;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Paste a WhatsApp/email inquiry and extract structured travel details.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Need Dubai visa for 2 adults on 15 July…"
        className="w-full resize-none rounded-md border border-input bg-card p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <Button
        className="w-full"
        loading={parse.isPending}
        disabled={text.trim().length < 3}
        onClick={() => parse.mutate(text)}
      >
        <Wand2 /> Extract details
      </Button>
      {result && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <Field label="Destination" value={result.destination} />
          <Field label="Service" value={result.service} />
          <Field label="Travelers" value={result.travelers?.toString() ?? null} />
          <Field label="Travel date" value={result.travelDate} />
        </div>
      )}
    </div>
  );
}

function FollowupPanel() {
  const [leadName, setLeadName] = useState('');
  const [inquiryType] = useState('VISA');
  const [status] = useState('PROPOSAL_SENT');
  const suggest = useFollowupSuggestion();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Generate a professional follow-up message for a lead.
      </p>
      <input
        value={leadName}
        onChange={(e) => setLeadName(e.target.value)}
        placeholder="Lead / agency name"
        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Badge tone="info">{titleCase(inquiryType)}</Badge>
        <Badge tone="primary">{titleCase(status)}</Badge>
      </div>
      <Button
        className="w-full"
        loading={suggest.isPending}
        disabled={!leadName.trim()}
        onClick={() => suggest.mutate({ leadName, inquiryType, status })}
      >
        <Wand2 /> Suggest message
      </Button>
      {suggest.data && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
          {suggest.data.message}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value ?? '—'}</span>
    </div>
  );
}
