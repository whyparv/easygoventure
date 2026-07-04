import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/app.exceptions';
import { AI_PROVIDER, AIProvider, ChatMessage } from './providers/ai-provider.interface';
import {
  HotelRecommendationService,
  type HotelRecommendations,
} from '../hotels/hotel-recommendation.service';
import { ProposalDraftDto } from './dto/proposal-draft.dto';
import { ParseInquiryDto } from './dto/parse-inquiry.dto';
import { FollowupSuggestionDto } from './dto/followup-suggestion.dto';
import { ProposalSummaryDto } from './dto/proposal-summary.dto';
import { ChatDto } from './dto/chat.dto';
import { NextActionDto } from './dto/next-action.dto';

export interface ParsedInquiry {
  customerName: string | null;
  /** The travel agency / company the enquiry comes from. */
  agencyName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  destination: string | null;
  service: string | null;
  /** Requested services as free-form labels (Visa, Airport Transfer, Desert Safari…). */
  services: string[];
  /** Hotels the client named in the inquiry. */
  requestedHotels: string[];
  /** AI-authored "CLIENT REQUIREMENTS" brief preserving the original intent. */
  requirementsNote: string | null;
  travelers: number | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
  travelDate: string | null;
  returnDate: string | null;
  budget: number | null;
  /** 0–100 extraction confidence for the whole enquiry. */
  confidence: number;
  /** Human-readable labels of the important fields that could NOT be extracted. */
  missing: string[];
}

export type NextActionType =
  | 'create_followup'
  | 'add_note'
  | 'update_status'
  | 'create_proposal'
  | 'none';

export interface NextAction {
  summary: string;
  action: {
    type: NextActionType;
    // create_followup
    scheduledDate?: string;
    remarks?: string;
    nextAction?: string;
    // add_note
    note?: string;
    // update_status
    status?: string;
    // create_proposal
    title?: string;
    proposalType?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
}

const NEXT_ACTION_TYPES: NextActionType[] = [
  'create_followup',
  'add_note',
  'update_status',
  'create_proposal',
  'none',
];
const LEAD_STATUSES = [
  'NEW',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONFIRMED',
  'ARRANGEMENTS',
  'VOUCHER_SENT',
  'COMPLETED',
  'REJECTED',
];
const PROPOSAL_TYPES = ['VISA', 'TRAVEL_PACKAGE', 'HOTEL', 'CUSTOM'];

/**
 * Shared persona for every prompt. Central place to tune the assistant's voice
 * and domain for travel & tour enquiries handled by a Destination Management
 * Company (DMC) selling to travel agencies.
 */
const DMC_ASSISTANT_PERSONA =
  'You are the AI operations assistant for a Destination Management Company (DMC) — ' +
  'a B2B travel wholesaler that arranges visas, hotels, airport transfers, tours & ' +
  'activities (e.g. desert safari, city tours, theme parks, yacht cruises) and holiday ' +
  'packages for travel agencies. You understand destinations, seasons, traveler counts ' +
  '(adults/children), nationalities and typical tour enquiry phrasing.';

@Injectable()
export class AIService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    private readonly hotels: HotelRecommendationService,
  ) {}

  /**
   * Endpoint 6 — generate a customer-facing proposal (Markdown) grounded in the
   * real hotel catalog. Uses destination/budget/travellers/dates to pull ranked
   * hotel recommendations, then drafts hotels + activities + transfers + visa.
   */
  async proposalDraft(
    dto: ProposalDraftDto,
  ): Promise<{ proposal: string; recommendations: HotelRecommendations }> {
    const recommendations = this.hotels.recommend({
      destination: dto.destination,
      budget: dto.budget,
      travelers: dto.travelers,
      nights: dto.nights,
    });
    const hotelLines = recommendations.tiers
      .flatMap((t) => t.hotels.map((h) => `- [${t.tier}] ${h.name} — ${h.rating}-star, ${h.location}`))
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. Write a polished, ` +
          'customer-facing travel PROPOSAL in clean Markdown that a travel agency can forward ' +
          'to the traveller. Structure it with: a short warm intro; a "Recommended Hotels" ' +
          'section rendered as a Markdown table (Hotel | Tier | Rating | Location) using ONLY ' +
          'the hotels provided; a "Tours & Activities" bullet list of typical experiences for ' +
          'the destination; an "Airport Transfers" note; a "Visa" note describing the typical ' +
          'process (never claim guaranteed approval); and a friendly closing. Do NOT invent ' +
          'prices, availability, or hotels that are not listed. Use headings and bullet points.',
      },
      {
        role: 'user',
        content:
          `Customer: ${dto.customerName ?? 'the traveller'}\n` +
          `Destination: ${recommendations.destination ?? dto.destination}\n` +
          `Travellers: ${recommendations.travelers}\nNights: ${recommendations.nights}\n` +
          `Budget: ${recommendations.budget ?? 'not specified'}\n` +
          `Suggested tier: ${recommendations.suggestedTier ?? 'n/a'}\n` +
          `Travel date: ${dto.travelDate ?? 'n/a'}\n\nRecommended hotels to include:\n` +
          (hotelLines || '(no catalog matches — suggest suitable hotel categories generically)'),
      },
    ];

    const proposal = await this.provider.chat(messages, { temperature: 0.5 });
    return { proposal, recommendations };
  }

  /** Endpoint 1 — extract structured fields from a free-text inquiry. */
  async parseInquiry(dto: ParseInquiryDto): Promise<ParsedInquiry> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. Extract structured ` +
          'data from a raw travel enquiry (which may be a pasted WhatsApp chat, an email, or ' +
          'free text). Respond ONLY with a JSON object with keys: ' +
          'customerName (the enquirer\'s / contact person\'s full name as a string | null), ' +
          'agencyName (the travel agency or company name, if mentioned | null), ' +
          'customerPhone (phone/WhatsApp number, digits and + only | null), ' +
          'customerEmail (email address | null), ' +
          'destination (city or country as a string, e.g. "Dubai" | null), service (the single ' +
          'primary service, one of Visa, Travel Package, Hotel, Transfer, Custom — map tours/' +
          'activities/sightseeing/desert safari to Travel Package, and anything unclear to Custom, ' +
          'or null), services (an ARRAY capturing EVERY service, activity or inclusion the client ' +
          'explicitly lists — one entry per listed item, preserving their wording, e.g. ' +
          '["Airport Transfer","UAE Visa","Daily Breakfast","Accommodation","Desert Safari with Dinner",' +
          '"Dolphin Show at Dubai Dolphinarium"]. Include named inclusions like "Daily Breakfast" and ' +
          '"Accommodation". Do not merge, summarise or omit lines; empty array if none stated), ' +
          'adults (number of adults as an integer | null), children (number of children | null), ' +
          'rooms (number of hotel rooms | null), ' +
          'travelers (total head count as an integer, summing adults and children | null), ' +
          'travelDate (ISO date YYYY-MM-DD | null; when a date has no year use the next future ' +
          'occurrence, never a past date, and pick the start/departure date for a range), ' +
          'returnDate (ISO date YYYY-MM-DD | null; the end/return date of a range if given), ' +
          'budget (total budget as a number in the stated or implied currency, digits only | null), ' +
          'requestedHotels (an ARRAY of hotel names the client explicitly named, e.g. ' +
          '["Al Khoory Sky Garden","Hilton Dubai Creek Residence"] — empty array if none), ' +
          'requirementsNote (a plain-text "CLIENT REQUIREMENTS" brief that preserves the ' +
          'operational intent for the sales staff. Use EXACTLY this structure with these ' +
          'headings, omitting a section only if it has no data:\\n' +
          'CLIENT REQUIREMENTS\\n\\nPassenger:\\n<name or "Not specified">\\n\\n' +
          'Travel Dates:\\n<e.g. 15 Jun - 19 Jun or "Not specified">\\n\\n' +
          'Requested Hotels:\\n- <hotel> (one per line, or "None specified")\\n\\n' +
          'Requested Services:\\n\\u2713 <service> (one per line prefixed with a check mark)\\n\\n' +
          'Notes:\\n<one short sentence interpreting what the client wants>. ' +
          'Base it ONLY on the enquiry — never invent hotels, services or dates), ' +
          'confidence (integer 0-100 for how confident you are in the overall extraction). ' +
          'Do not invent values — use null (or [] for arrays) when the enquiry does not state something.',
      },
      { role: 'user', content: dto.text },
    ];

    const raw = await this.provider.chat(messages, { json: true, temperature: 0 });
    const parsed = this.parseJson<Partial<ParsedInquiry>>(raw);

    const adults = this.asNumber(parsed.adults);
    const children = this.asNumber(parsed.children);
    const travelers =
      this.asNumber(parsed.travelers) ??
      (adults !== null || children !== null ? (adults ?? 0) + (children ?? 0) : null);

    const result = {
      customerName: this.asString(parsed.customerName),
      agencyName: this.asString(parsed.agencyName),
      customerPhone: this.asString(parsed.customerPhone),
      customerEmail: this.asString(parsed.customerEmail),
      destination: this.asString(parsed.destination),
      service: this.asString(parsed.service),
      services: this.asStringArray(parsed.services),
      requestedHotels: this.asStringArray(parsed.requestedHotels),
      requirementsNote: this.asString(parsed.requirementsNote),
      travelers,
      adults,
      children,
      rooms: this.asNumber(parsed.rooms),
      travelDate: this.asString(parsed.travelDate),
      returnDate: this.asString(parsed.returnDate),
      budget: this.asNumber(parsed.budget),
    };
    // Prefer the model's self-reported confidence; otherwise derive it from how
    // many scalar fields were actually extracted (so the UI always has a signal).
    const reported = this.asNumber(parsed.confidence);
    const scalars = Object.entries(result).filter(
      ([k]) => k !== 'services' && k !== 'requestedHotels' && k !== 'requirementsNote',
    );
    const filled = scalars.filter(([, v]) => v !== null).length;
    const confidence =
      reported !== null
        ? Math.max(0, Math.min(100, reported))
        : Math.round((filled / scalars.length) * 100);

    // Surface the important fields we could NOT extract so the agent can chase them.
    const IMPORTANT: Array<[keyof typeof result, string]> = [
      ['customerName', 'Contact Person'],
      ['agencyName', 'Agency'],
      ['customerPhone', 'Phone'],
      ['destination', 'Destination'],
      ['travelDate', 'Travel Date'],
    ];
    const missing = IMPORTANT.filter(([k]) => result[k] === null).map(([, label]) => label);

    return { ...result, confidence, missing };
  }

  /** Endpoint 2 — suggest a follow-up message for a lead. */
  async followupSuggestion(dto: FollowupSuggestionDto): Promise<{ message: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Write a concise, professional, friendly follow-up ` +
          'message (max 3 sentences) the agent can send to the travel agency about their ' +
          'enquiry. Reference the destination/service where helpful, keep a warm B2B tone, ' +
          'and end with a clear next step. Return only the message text — no greeting ' +
          'placeholders like "[Name]" and no signature.',
      },
      {
        role: 'user',
        content:
          `Lead: ${dto.leadName}\nInquiry type: ${dto.inquiryType}\n` +
          `Current status: ${dto.status}\nContext: ${dto.context ?? 'n/a'}`,
      },
    ];

    const message = await this.provider.chat(messages, { temperature: 0.5 });
    return { message };
  }

  /** Endpoint 3 — turn proposal details into a client-friendly summary. */
  async proposalSummary(dto: ProposalSummaryDto): Promise<{ summary: string }> {
    const price =
      dto.amount !== undefined ? `${dto.currency ?? 'USD'} ${dto.amount}` : 'on request';
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Write a clear, persuasive, client-friendly summary of ` +
          'the proposal (max 4 sentences) that the agency can forward to the traveler. ' +
          'Highlight the destination, what is included, and the value — keep it factual, ' +
          'do not invent inclusions or prices that are not provided. Return only the summary.',
      },
      {
        role: 'user',
        content:
          `Title: ${dto.title}\nType: ${dto.proposalType}\nPrice: ${price}\n` +
          `Details: ${dto.description ?? 'n/a'}`,
      },
    ];

    const summary = await this.provider.chat(messages, { temperature: 0.4 });
    return { summary };
  }

  /** Endpoint 4 — free-form conversational assistant for DMC operations. */
  async chat(dto: ChatDto): Promise<{ reply: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. You help the DMC's ` +
          'agents with their day-to-day work: explaining visa requirements and documents, ' +
          'suggesting itineraries, packages, hotels, transfers, tours & activities for a ' +
          'destination, advising what to include in a quotation, drafting WhatsApp/email ' +
          'replies and follow-ups, and answering general travel-operations questions. You are ' +
          'also a CRM copilot: you CAN help capture leads. When a message contains customer ' +
          'details (name, phone, email, destination, dates, pax, budget), extract them, point ' +
          'out what is still missing, and tell the agent they can create the lead and its ' +
          'inquiry in one step via "Create → Lead" (AI Assisted) by pasting the message — ' +
          'NEVER reply that you cannot create leads or that this is outside your ability. Be ' +
          'accurate, concise and practical; use short paragraphs or bullet points. When a ' +
          'request is missing key details (destination, dates, nationality, pax, budget), ' +
          'ask a brief clarifying question. Do not invent specific prices, availability or ' +
          'visa approvals — describe typical ranges/processes and flag when live confirmation ' +
          'is needed. Stay within travel/DMC topics.',
      },
      ...(dto.context
        ? [
            {
              role: 'system' as const,
              content:
                'The agent is currently viewing this CRM record. Use it to answer ' +
                'specifically about this lead/deal; refer to real names, statuses, ' +
                `amounts and dates from it rather than generic advice.\n\n${dto.context}`,
            },
          ]
        : []),
      ...(dto.history ?? []).map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: dto.message },
    ];

    const reply = await this.provider.chat(messages, { temperature: 0.5, maxTokens: 1200 });
    return { reply };
  }

  /** Endpoint 5 — recommend the single best next action for the current lead. */
  async nextAction(dto: NextActionDto): Promise<NextAction> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. Recommend the SINGLE ` +
          'best next action to move this lead forward, grounded in the record below. ' +
          'Respond ONLY with a JSON object: { "summary": string (one sentence why), ' +
          '"action": { "type": one of "create_followup" | "add_note" | "update_status" | ' +
          '"create_proposal" | "none", ...fields } }. Fields by type: ' +
          'create_followup → scheduledDate (YYYY-MM-DD, a future date), remarks, nextAction; ' +
          'add_note → note; update_status → status (one of NEW, QUOTE_SENT, ' +
          'FOLLOW_UP, CONFIRMED, ARRANGEMENTS, VOUCHER_SENT, COMPLETED, REJECTED); create_proposal → ' +
          'title, proposalType (VISA | TRAVEL_PACKAGE | HOTEL | CUSTOM), amount (number, ' +
          'optional — omit if unknown, never guess a price), currency (default USD), ' +
          'description. Prefer a follow-up or note unless a proposal is clearly the next ' +
          'step. Use "none" if nothing is needed.',
      },
      { role: 'system', content: `CRM record:\n${dto.context}` },
      { role: 'user', content: dto.message?.trim() || 'What is the best next action?' },
    ];

    const raw = await this.provider.chat(messages, {
      json: true,
      temperature: 0.2,
      maxTokens: 700,
    });
    return this.normalizeNextAction(this.parseJson(raw));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Validate/coerce the model's action JSON into a safe, typed shape. */
  private normalizeNextAction(raw: unknown): NextAction {
    const root = (raw ?? {}) as Record<string, unknown>;
    const rawAction = (root.action ?? {}) as Record<string, unknown>;

    const type = NEXT_ACTION_TYPES.includes(rawAction.type as NextActionType)
      ? (rawAction.type as NextActionType)
      : 'none';
    const summary = this.asString(root.summary) ?? 'No specific action recommended.';

    const action: NextAction['action'] = { type };
    switch (type) {
      case 'create_followup':
        action.scheduledDate = this.asString(rawAction.scheduledDate) ?? undefined;
        action.remarks = this.asString(rawAction.remarks) ?? undefined;
        action.nextAction = this.asString(rawAction.nextAction) ?? undefined;
        break;
      case 'add_note':
        action.note = this.asString(rawAction.note) ?? undefined;
        break;
      case 'update_status': {
        const status = this.asString(rawAction.status);
        action.status = status && LEAD_STATUSES.includes(status) ? status : undefined;
        break;
      }
      case 'create_proposal': {
        action.title = this.asString(rawAction.title) ?? undefined;
        const pType = this.asString(rawAction.proposalType);
        action.proposalType = pType && PROPOSAL_TYPES.includes(pType) ? pType : 'CUSTOM';
        action.amount = this.asNumber(rawAction.amount) ?? undefined;
        action.currency = (this.asString(rawAction.currency) ?? 'USD').slice(0, 3).toUpperCase();
        action.description = this.asString(rawAction.description) ?? undefined;
        break;
      }
      default:
        break;
    }

    // If a required field is missing, downgrade to a safe non-destructive action.
    if (type === 'update_status' && !action.status) return { summary, action: { type: 'none' } };
    if (type === 'create_proposal' && !action.title)
      return { summary, action: { type: 'none' } };

    return { summary, action };
  }

  /** Current date as YYYY-MM-DD, injected so the model can resolve relative dates. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const candidate = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;

    try {
      return JSON.parse(candidate) as T;
    } catch {
      throw new BusinessException('AI returned malformed JSON', 'AI_PARSE_ERROR');
    }
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return null;
  }

  /** Coerce a model value into a clean, de-duplicated array of service labels. */
  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of value) {
      const s = this.asString(item);
      if (s && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
    }
    return out;
  }
}
