import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, MessageSquarePlus, Plane, Plus, Send, Sparkles, Trash2, User } from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Markdown } from '@shared/components/ui/markdown';
import { ROUTES } from '@app/config/routes';
import { useAiChat } from '@shared/mutations/ai.mutations';
import { useAuthStore } from '@shared/stores/auth.store';
import { cn } from '@shared/utils/cn';
import { formatRelative } from '@shared/lib/format';
import type { ChatTurn } from '@shared/services/ai.service';

interface Conversation {
  id: string;
  title: string;
  messages: ChatTurn[];
  updatedAt: number;
}

const SUGGESTIONS = [
  'Plan a premium 5-day Dubai itinerary for a couple',
  'Draft a proposal for a family trip to Dubai (2 adults, 1 child)',
  'Draft a WhatsApp reply confirming a Dubai package quote',
  'What documents are needed for a UAE tourist visa?',
  'Best time to visit the Maldives and why',
];
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

export default function AiPage() {
  const userId = useAuthStore((s) => s.user?.id ?? 'anon');
  const storeKey = `dmc-ai-conv-${userId}`;

  const [conversations, setConversations] = useState<Conversation[]>(() => load(storeKey));
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id ?? uid());
  const [input, setInput] = useState('');
  const chat = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo<Conversation>(
    () => conversations.find((c) => c.id === activeId) ?? { id: activeId, title: 'New chat', messages: [], updatedAt: Date.now() },
    [conversations, activeId],
  );
  const messages = active.messages;

  useEffect(() => {
    persist(storeKey, conversations);
  }, [conversations, storeKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending]);

  const upsert = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === id);
      const base = exists ? prev : [{ id, title: 'New chat', messages: [], updatedAt: Date.now() }, ...prev];
      return base.map((c) => (c.id === id ? updater(c) : c)).sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || chat.isPending) return;
    const history = messages;
    setInput('');
    upsert(activeId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 48) : c.title,
      messages: [...c.messages, { role: 'user', content: text }],
      updatedAt: Date.now(),
    }));
    chat.mutate(
      { message: text, history, context: undefined },
      {
        onSuccess: (data) =>
          upsert(activeId, (c) => ({ ...c, messages: [...c.messages, { role: 'assistant', content: data.reply }], updatedAt: Date.now() })),
        onError: () =>
          upsert(activeId, (c) => ({
            ...c,
            messages: [...c.messages, { role: 'assistant', content: "⚠️ I couldn't reach the AI service. Please try again." }],
            updatedAt: Date.now(),
          })),
      },
    );
  };

  const newChat = () => setActiveId(uid());
  const remove = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(uid());
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] gap-4">
      {/* Recent conversations */}
      <aside className="hidden w-64 shrink-0 flex-col lg:flex">
        <Button size="sm" variant="secondary" className="mb-3 justify-start" onClick={newChat}>
          <Plus /> New conversation
        </Button>
        <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent · kept 7 days
        </p>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  c.id === activeId ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <MessageSquarePlus className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{c.title || 'New chat'}</span>
                <span className="hidden shrink-0 text-[10px] text-muted-foreground group-hover:hidden">
                  {formatRelative(new Date(c.updatedAt).toISOString())}
                </span>
                <Trash2
                  className="hidden size-3.5 shrink-0 text-danger group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(c.id);
                  }}
                />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">AI Workspace</p>
            <p className="truncate text-xs text-muted-foreground">
              Itineraries · proposals · WhatsApp drafts · visa · research — to capture a customer, use{' '}
              <Link to={`${ROUTES.leads}?new=1`} className="text-primary hover:underline">
                Create → Lead
              </Link>
            </p>
          </div>
          <Button size="sm" variant="ghost" className="ml-auto lg:hidden" onClick={newChat}>
            <Plus /> New
          </Button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Plane className="size-7" />
              </div>
              <p className="mt-3 text-lg font-semibold text-foreground">How can I help?</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Itineraries, visa rules, destination advice — ask like you would a senior travel consultant.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} turn={m} />)
          )}
          {chat.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="size-4" /> <span className="animate-pulse">Thinking…</span>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
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
              placeholder="Message the assistant…"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="icon" onClick={() => send(input)} disabled={!input.trim() || chat.isPending} aria-label="Send">
              <Send />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-pink text-pink-foreground',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm border border-border bg-surface text-foreground',
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{turn.content}</span>
        ) : (
          <Markdown content={turn.content} />
        )}
      </div>
    </div>
  );
}

// ── localStorage-backed history (per user, 7-day retention) ──────────────────
function load(key: string): Conversation[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const all = JSON.parse(raw) as Conversation[];
    const fresh = all.filter((c) => Date.now() - c.updatedAt < RETENTION_MS);
    if (fresh.length !== all.length) localStorage.setItem(key, JSON.stringify(fresh));
    return fresh.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}
function persist(key: string, conversations: Conversation[]) {
  try {
    const fresh = conversations.filter((c) => c.messages.length > 0 && Date.now() - c.updatedAt < RETENTION_MS);
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}
