import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/app.exceptions';
import { AI_PROVIDER, AIProvider, ChatMessage, ChatOptions } from './providers/ai-provider.interface';
import { AgenciesService } from '../agencies/agencies.service';
import {
  HotelRecommendationService,
  type HotelRecommendations,
} from '../hotels/hotel-recommendation.service';
import { BrainService } from '../brain/brain.service';
import { HotelsService, type HotelResult } from '../hotels/hotels.service';
import { ServicesService } from '../service-catalog/services.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ProposalDraftDto } from './dto/proposal-draft.dto';
import { ParseInquiryDto } from './dto/parse-inquiry.dto';
import { FollowupSuggestionDto } from './dto/followup-suggestion.dto';
import { ProposalSummaryDto } from './dto/proposal-summary.dto';
import { ChatDto } from './dto/chat.dto';
import { LeadChatDto } from './dto/lead-chat.dto';
import { LeadIntakeChatDto, type LeadIntakeChatResponse } from './dto/lead-intake-chat.dto';
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
  'You are the AI operations assistant for a Destination Management Company (DMC) - ' +
  'a B2B travel wholesaler that arranges visas, hotels, airport transfers, tours & ' +
  'activities (e.g. desert safari, city tours, theme parks, yacht cruises) and holiday ' +
  'packages for travel agencies. You understand destinations, seasons, traveler counts ' +
  '(adults/children), nationalities and typical tour enquiry phrasing.';

@Injectable()
export class AIService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    private readonly hotelRecommendations: HotelRecommendationService,
    private readonly brain: BrainService,
    private readonly hotelsService: HotelsService,
    private readonly servicesService: ServicesService,
    private readonly agenciesService: AgenciesService,
  ) {}

  /**
   * Endpoint 6 - generate a customer-facing proposal (Markdown) grounded in the
   * real hotel catalog. Uses destination/budget/travellers/dates to pull ranked
   * hotel recommendations, then drafts hotels + activities + transfers + visa.
   */
  async proposalDraft(
    dto: ProposalDraftDto,
  ): Promise<{ proposal: string; recommendations: HotelRecommendations }> {
    const recommendations = this.hotelRecommendations.recommend({
      destination: dto.destination,
      budget: dto.budget,
      travelers: dto.travelers,
      nights: dto.nights,
    });
    const hotelLines = recommendations.tiers
      .flatMap((t) => t.hotels.map((h) => `- [${t.tier}] ${h.name} - ${h.rating}-star, ${h.location}`))
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
          (hotelLines || '(no catalog matches - suggest suitable hotel categories generically)'),
      },
    ];

    const proposal = await this.provider.chat(messages, { temperature: 0.5 });
    return { proposal, recommendations };
  }

  /** Endpoint 1 - extract structured fields from a free-text inquiry. */
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

  /** Endpoint 2 - suggest a follow-up message for a lead. */
  async followupSuggestion(dto: FollowupSuggestionDto): Promise<{ message: string }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Write a concise, professional, friendly follow-up ` +
          'message (max 3 sentences) the agent can send to the travel agency about their ' +
          'enquiry. Reference the destination/service where helpful, keep a warm B2B tone, ' +
          'and end with a clear next step. Return only the message text - no greeting ' +
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

  /** Endpoint 3 - turn proposal details into a client-friendly summary. */
  async proposalSummary(dto: ProposalSummaryDto): Promise<{ summary: string }> {
    const price =
      dto.amount !== undefined ? `${dto.currency ?? 'USD'} ${dto.amount}` : 'on request';
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Write a clear, persuasive, client-friendly summary of ` +
          'the proposal (max 4 sentences) that the agency can forward to the traveler. ' +
          'Highlight the destination, what is included, and the value - keep it factual, ' +
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

  /** Endpoint 4 - free-form conversational assistant for DMC operations. */
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
          'inquiry in one step via "Create → Lead" (AI Assisted) by pasting the message - ' +
          'NEVER reply that you cannot create leads or that this is outside your ability. Be ' +
          'accurate, concise and practical; use short paragraphs or bullet points. When a ' +
          'request is missing key details (destination, dates, nationality, pax, budget), ' +
          'ask a brief clarifying question. Do not invent specific prices, availability or ' +
          'visa approvals - describe typical ranges/processes and flag when live confirmation ' +
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

  /** Endpoint 5 - recommend the single best next action for the current lead. */
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
          'optional - omit if unknown, never guess a price), currency (default USD), ' +
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

  /** Lead-specific chat that injects the org's brain prompt for the 'leads' section. */
  async leadChat(
    dto: LeadChatDto,
    actor: AuthenticatedUser,
  ): Promise<{ reply: string }> {
    const brainPrompt = await this.brain.getPrompt(actor, 'leads');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `${DMC_ASSISTANT_PERSONA} Today's date is ${this.today()}. You are the dedicated ` +
          'AI assistant for a specific lead. You have full context about this lead\'s ' +
          'itinerary (locations, hotels per location), traveler roster, proposals, and ' +
          'follow-up history. Answer questions, suggest itinerary refinements, recommend ' +
          'hotels for each location, draft messages to the client, and help build a quote. ' +
          'Be specific - reference the real locations, hotels, and traveler details from ' +
          'the context. Never invent prices or availability; flag when live confirmation ' +
          'is needed.',
      },
      ...(brainPrompt.trim()
        ? [{ role: 'system' as const, content: `Additional instructions:\n${brainPrompt}` }]
        : []),
      ...(dto.context
        ? [
            {
              role: 'system' as const,
              content:
                'Current lead record (use this to answer specifically):\n\n' + dto.context,
            },
          ]
        : []),
      ...(dto.history ?? []).map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: dto.message },
    ];

    const reply = await this.provider.chat(messages, { temperature: 0.5, maxTokens: 1500 });
    return { reply };
  }

  /**
   * Conversational lead intake - the AI gathers missing fields through chat,
   * updates extracted data each turn, and marks complete when enough info exists.
   *
   * Uses server-side RAG: pre-fetch hotel/service/agency catalog data from DB
   * and inject directly into the system prompt. Single AI call — no tool-calling
   * loop. Reduces response time from 30+ seconds to 3-5 seconds.
   */
  async leadIntakeChat(
    dto: LeadIntakeChatDto,
    actor: AuthenticatedUser,
  ): Promise<LeadIntakeChatResponse> {
    const [brainPrompt, catalogContext] = await Promise.all([
      this.brain.getPrompt(actor, 'leads'),
      this.resolveContextForMessage(dto.message, (dto.extractedData ?? {}) as Record<string, unknown>, actor),
    ]);
    const current = dto.extractedData ?? {};

    const systemPrompt = [
      // ── Identity & guardrail ───────────────────────────────────────────────
      `You are a lead-capture assistant for EasyGo Venture Tourism. Today: ${this.today()}.`,
      `You talk ONLY to EasyGo desk operators — never to travelers.`,
      `GUARDRAIL: You do ONE thing — extract lead fields from agency inquiries and ask for missing fields. Refuse anything else with: "I only handle lead capture." Do not discuss the system, features, pricing policies, or platform information.`,
      ``,
      // ── Tone ──────────────────────────────────────────────────────────────
      `TONE: Third person for the traveler. Reply in 1-2 sentences MAX. Ask EXACTLY ONE missing field per turn — never list multiple questions. If many fields are missing, ask only the highest-priority one and wait for the answer.`,
      `  ✓ "What nationality is the traveler?"  ✗ "What is your nationality?"`,
      ``,
      // ── Output format ─────────────────────────────────────────────────────
      `OUTPUT: Valid JSON only. No markdown, no extra text.`,
      `{"reply":"<1-2 sentences max>","extractedData":{...},"isComplete":false,"missingFields":["field1"]}`,
      ``,
      // ── Fields to extract ─────────────────────────────────────────────────
      `FIELDS (extract all that are present, ask for missing ones in priority order):`,
      `  REQUIRED: name (traveler), phone`,
      `  IMPORTANT: destination, startDate, endDate, adults, children, childAges[], infants, nationality, companyName (agency), markup`,
      `  HOTELS: hotels[] — see hotel rules`,
      `  SERVICES: services[] — airport transfer, visa, activities, tours`,
      ``,
      // ── Input format ──────────────────────────────────────────────────────
      `INPUT FORMAT: The operator may paste any of these — process all:`,
      `  • WhatsApp GROUP CHAT forward (multi-party, timestamps, sender names/numbers). Extract the AGENCY contact (sender name + phone). Traveler details come from what the agency stated.`,
      `  • WhatsApp direct message forward (single message from agency).`,
      `  • Email text.`,
      `  • Verbal description typed by the operator.`,
      `WHATSAPP GROUP CHAT PARSING: Lines follow pattern "[HH:MM] Name/+number: message". The agency contact is the non-EasyGo sender. Extract their name and phone from the chat participants. Date ranges like "27-31 aug" → startDate=YYYY-08-27, endDate=YYYY-08-31. "chd"/"chil" = children, "pax" = total travelers.`,
      ``,
      // ── Extraction rules ─────────────────────────────────────────────────
      `EXTRACTION RULES:`,
      `1. name = traveler's name OR agency contact name if traveler name not stated. phone = agency/traveler phone (any format, include country code if present).`,
      `2. companyName = agency name. In group chats, the group name often contains it (e.g. "Travel Den Lagos // Easy Go" → companyName="Travel Den Lagos").`,
      `3. destination = comma-separated cities ("Dubai, Doha"). destinations[] = [{city, nights, checkIn, checkOut, order}] for each stop.`,
      `4. Multi-city dates: checkOut of city N = checkIn of city N+1. startDate = first city checkIn, endDate = last city checkOut.`,
      `5. travelers = adults + children + infants (total). childAges[] = [age1, age2] as integers. "chd"/"chil" = children.`,
      `6. markup = margin % as a number (e.g. "15% margin" → 15). Ask once basics are captured.`,
      `7. isComplete = true ONLY when name AND phone are both known.`,
      `8. Never put hotel/service info in notes. Always use hotels[] and services[].`,
      ``,
      // ── Hotel rules ───────────────────────────────────────────────────────
      `HOTEL RULES:`,
      `- ALWAYS suggest 2-3 distinct hotel ALTERNATIVES per destination from CATALOG DATA (different hotel names, same city). These are options for the agency to choose from — not all booked together.`,
      `- Same hotel, different room types → separate entries (same name, different roomType).`,
      `- Sequential cities → separate entries per city.`,
      `- 2 rooms, type unspecified → set roomCount=2, ask room types before splitting.`,
      `- occupancyType: SINGLE|DOUBLE|TRIPLE (default DOUBLE). Room capacity: SINGLE=1/room, DOUBLE=2/room, TRIPLE=3/room. roomCount = ceil(segmentPax / capacity) — EXAMPLES: 5 pax double → 3 rooms; 4 pax double → 2 rooms; 5 pax single → 5 rooms; 6 pax triple → 2 rooms. paxCount = pax in this segment (omit when all pax share same type).`,
      `- Mixed occupancy example: 3 pax want 1 single + 1 double at the SAME hotel → two entries: {name:"X", roomType:"Single Room", occupancyType:"SINGLE", paxCount:1, roomCount:1} + {name:"X", roomType:"Double Room", occupancyType:"DOUBLE", paxCount:2, roomCount:1}. Repeat this pattern for EACH hotel option.`,
      `- Meal plan suffix on roomType: BB=Bed & Breakfast, HB=Half Board, FB=Full Board, AI=All-Inclusive, RO=Room Only.`,
      `- Use EXACT names from CATALOG DATA. If catalog has fewer than 2 hotels: use numbered placeholders ("5-Star Hotel A Dubai", "5-Star Hotel B Dubai").`,
      ``,
      // ── Service rules ─────────────────────────────────────────────────────
      `SERVICE RULES:`,
      `- PRIVATE = per-person rate (visa, private transfer, ticket). SHARED = unit cost split by pax (sedan, safari group).`,
      `- Airport transfer = PRIVATE (each traveler). Use CATALOG DATA prices when available.`,
      ``,
      // ── Catalog data ─────────────────────────────────────────────────────
      catalogContext || '',
      ``,
      // ── Ask priority ─────────────────────────────────────────────────────
      `ASK PRIORITY (one at a time): traveler name → phone → destination → dates → per-city nights → pax breakdown → child ages → nationality → markup.`,
      ``,
      // ── Examples ─────────────────────────────────────────────────────────
      `EXAMPLE A — Multi-city, 3 hotel options per city, mixed occupancy (1 single + 1 double):`,
      `Input: "Parv Jain, D&D Travels, 8085816197, Dubai 3N + Doha 4N, 5-star, 3 pax (1 single + 1 double room), desert safari, airport transfer"`,
      `{"reply":"Lead logged — Parv Jain from D&D Travels, Dubai (3N) + Doha (4N), 3 pax mixed occupancy. What are the travel dates?","extractedData":{"name":"Parv Jain","phone":"8085816197","companyName":"D&D Travels","destination":"Dubai, Doha","travelers":3,"adults":3,"destinations":[{"city":"Dubai","nights":3,"order":1},{"city":"Doha","nights":4,"order":2}],"hotels":[{"city":"Dubai","name":"5-Star Hotel A Dubai","nights":3,"rating":5,"roomType":"Single Room","occupancyType":"SINGLE","paxCount":1,"roomCount":1},{"city":"Dubai","name":"5-Star Hotel A Dubai","nights":3,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","paxCount":2,"roomCount":1},{"city":"Dubai","name":"5-Star Hotel B Dubai","nights":3,"rating":5,"roomType":"Single Room","occupancyType":"SINGLE","paxCount":1,"roomCount":1},{"city":"Dubai","name":"5-Star Hotel B Dubai","nights":3,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","paxCount":2,"roomCount":1},{"city":"Dubai","name":"5-Star Hotel C Dubai","nights":3,"rating":5,"roomType":"Single Room","occupancyType":"SINGLE","paxCount":1,"roomCount":1},{"city":"Dubai","name":"5-Star Hotel C Dubai","nights":3,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","paxCount":2,"roomCount":1},{"city":"Doha","name":"5-Star Hotel A Doha","nights":4,"rating":5,"roomType":"Single Room","occupancyType":"SINGLE","paxCount":1,"roomCount":1},{"city":"Doha","name":"5-Star Hotel A Doha","nights":4,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","paxCount":2,"roomCount":1},{"city":"Doha","name":"5-Star Hotel B Doha","nights":4,"rating":5,"roomType":"Single Room","occupancyType":"SINGLE","paxCount":1,"roomCount":1},{"city":"Doha","name":"5-Star Hotel B Doha","nights":4,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","paxCount":2,"roomCount":1}],"services":[{"name":"Airport Transfer","pricingType":"PRIVATE","basePricePerUnit":200,"currency":"AED"},{"name":"Desert Safari","pricingType":"SHARED","capacity":1,"basePricePerUnit":150,"currency":"AED"}]},"isComplete":false,"missingFields":["startDate"]}`,
      ``,
      `EXAMPLE B — Single city, 3 hotel options, 5 pax double occupancy (ceil(5/2)=3 rooms):`,
      `Input: "Dubai 5N, 5 adults, 5-star options, double room"`,
      `{"reply":"3 five-star options queued for Dubai (5N), 5 pax double occ. (3 rooms each). What are the travel dates?","extractedData":{"destination":"Dubai","destinations":[{"city":"Dubai","nights":5,"order":1}],"hotels":[{"city":"Dubai","name":"5-Star Hotel A Dubai","nights":5,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3},{"city":"Dubai","name":"5-Star Hotel B Dubai","nights":5,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3},{"city":"Dubai","name":"5-Star Hotel C Dubai","nights":5,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3}],"travelers":5,"adults":5},"isComplete":false,"missingFields":["name","phone","startDate"]}`,
      ``,
      `EXAMPLE C — WhatsApp GROUP CHAT paste (extract agency contact + lead from conversation thread):`,
      `Input: "Travel Den Lagos // Easy Go Venture Tourism Dubai\n[12:30 PM] +234 813 066 5018: 5 adults + 1 chd\n[12:30 PM] You: @Anshul share the quote for 5 adults + 1 chd 27-31 aug package\n[12:32 PM] You: we also do doha though"`,
      `{"reply":"Got it — 5 adults + 1 child from Travel Den Lagos, Dubai 27–31 Aug (4N) + Doha. I'll queue 3 hotel options per city. What is the lead traveler's name?","extractedData":{"phone":"+2348130665018","companyName":"Travel Den Lagos","destination":"Dubai, Doha","adults":5,"children":1,"travelers":6,"startDate":"${new Date().getFullYear()}-08-27","endDate":"${new Date().getFullYear()}-08-31","destinations":[{"city":"Dubai","nights":4,"order":1},{"city":"Doha","nights":0,"order":2}],"hotels":[{"city":"Dubai","name":"5-Star Hotel A Dubai","nights":4,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3},{"city":"Dubai","name":"5-Star Hotel B Dubai","nights":4,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3},{"city":"Dubai","name":"5-Star Hotel C Dubai","nights":4,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3},{"city":"Doha","name":"5-Star Hotel A Doha","nights":3,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3},{"city":"Doha","name":"5-Star Hotel B Doha","nights":3,"rating":5,"roomType":"Double Room","occupancyType":"DOUBLE","roomCount":3}],"services":[{"name":"Airport Transfer","pricingType":"PRIVATE","basePricePerUnit":200,"currency":"AED"}]},"isComplete":false,"missingFields":["name","startDate"]}`,
      ``,
      `EXAMPLE D — Off-topic question (guardrail):`,
      `Input: "How many portals does EasyGo have?"`,
      `{"reply":"I only handle lead capture. Please paste the agency inquiry or describe the traveler's requirements.","extractedData":{},"isComplete":false,"missingFields":[]}`,
      ``,
      // ── Current state ─────────────────────────────────────────────────────
      `Current extracted data (merge — never overwrite non-null with null):`,
      JSON.stringify(current, null, 2),
      brainPrompt.trim() ? `Org instructions:\n${brainPrompt}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(dto.history ?? []).map((t) => ({ role: t.role, content: t.content })),
      { role: 'user', content: dto.message },
    ];

    const raw = await this.provider.chat(messages, { temperature: 0.1, maxTokens: 800, json: true });

    let parsed: LeadIntakeChatResponse;
    try {
      const jsonStr = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const obj = JSON.parse(jsonStr) as Partial<LeadIntakeChatResponse>;
      const ed = (obj.extractedData ?? {}) as Record<string, unknown>;
      const merged = { ...current, ...ed } as LeadIntakeChatResponse['extractedData'];

      // Arrays: only replace if the AI returned a non-empty array; otherwise preserve existing
      const keepOrReplace = <T>(aiVal: unknown, existing: T[] | undefined): T[] | undefined => {
        if (Array.isArray(aiVal) && (aiVal as T[]).length > 0) return aiVal as T[];
        if (Array.isArray(existing) && existing.length > 0) return existing;
        return Array.isArray(aiVal) ? (aiVal as T[]) : undefined;
      };

      merged.hotels = keepOrReplace(ed.hotels, current.hotels as LeadIntakeChatResponse['extractedData']['hotels']);
      merged.services = keepOrReplace(ed.services, current.services as LeadIntakeChatResponse['extractedData']['services']);
      merged.destinations = keepOrReplace(ed.destinations, current.destinations as LeadIntakeChatResponse['extractedData']['destinations']);
      merged.childAges = keepOrReplace(ed.childAges, current.childAges);
      // Preserve scalar fields the AI didn't explicitly update
      if (ed.markup == null && current.markup != null) merged.markup = current.markup as number;

      parsed = {
        reply: this.asString(obj.reply) ?? 'Got it! Could you share more details?',
        extractedData: merged,
        isComplete: Boolean(obj.isComplete),
        missingFields: Array.isArray(obj.missingFields) ? obj.missingFields : [],
        whatsappGreeting: this.asString(obj.whatsappGreeting) ?? undefined,
      };
    } catch {
      parsed = {
        reply: raw,
        extractedData: current as unknown as LeadIntakeChatResponse['extractedData'],
        isComplete: false,
        missingFields: [],
      };
    }

    // Enrich extracted hotels/services with real catalog data
    parsed.extractedData = await this.enrichExtractedData(parsed.extractedData, actor);

    return parsed;
  }

  // ── Server-side RAG ───────────────────────────────────────────────────────


  /**
   * Pre-fetch hotels/services/agencies from the DB based on the message content
   * and current extracted data, then return a formatted context block to inject
   * into the system prompt. This replaces the tool-calling loop with a single
   * parallel DB fetch (~50ms), reducing total response time to one AI call.
   */
  private async resolveContextForMessage(
    message: string,
    current: Record<string, unknown>,
    actor: AuthenticatedUser,
  ): Promise<string> {
    const lower = message.toLowerCase();
    const cities = this.extractCitiesFromContext(message, current);
    const serviceKw = this.extractServiceKeywords(lower);
    const agencyKw = this.extractAgencyKeyword(message);

    type HotelRow = { name: string; starRating?: number; area?: string };
    const hotelsByCity = new Map<string, HotelRow[]>();

    // Fetch hotels per city and for specific hotel name mentions in parallel
    const hotelNameKw = this.extractHotelNameKeywords(message);

    const [cityHotelResults, namedHotelResults, serviceResult, agencyResult] = await Promise.all([
      // Broad city-level fetch (up to 15 per city)
      Promise.all(
        cities.map((city) =>
          this.hotelsService
            .findAll(
              Object.assign(Object.create(null), {
                city,
                limit: 15,
                page: 1,
                sortOrder: 'desc',
              }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            )
            .then((r) => ({ city, data: r.data }))
            .catch(() => ({ city, data: [] })),
        ),
      ),
      // Specific hotel name search (with fuzzy fallback)
      Promise.all(
        hotelNameKw.map(async (kw) => {
          const city = cities[0] ?? 'Dubai';
          try {
            const r = await this.hotelsService.findAll(
              Object.assign(Object.create(null), {
                city,
                search: kw,
                limit: 5,
                page: 1,
                sortOrder: 'desc',
              }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            if (r.data.length >= 1) return { city, data: r.data };
            // Fuzzy fallback
            const all = await this.hotelsService.findAll(
              Object.assign(Object.create(null), {
                city,
                limit: 60,
                page: 1,
                sortOrder: 'desc',
              }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            const fuzzy = this.fuzzyHotelMatch(kw, all.data);
            return { city, data: fuzzy ? [fuzzy] : [] };
          } catch {
            return { city, data: [] };
          }
        }),
      ),
      serviceKw.length > 0
        ? this.servicesService
            .findAll(
              Object.assign(Object.create(null), {
                search: serviceKw[0],
                isActive: 'true',
                limit: 6,
                page: 1,
                sortOrder: 'asc',
              }) as import('../service-catalog/dto/query-service.dto').QueryServiceDto,
              actor,
            )
            .catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] as Array<{ name: string; categoryCode: string; defaultSellPrice?: number; basePrice?: number }> }),
      agencyKw
        ? this.agenciesService
            .findAll(
              Object.assign(Object.create(null), {
                search: agencyKw,
                limit: 3,
                page: 1,
                sortOrder: 'asc',
              }) as import('../agencies/dto/query-agency.dto').QueryAgencyDto,
              actor,
            )
            .catch(() => ({ data: [] as Array<{ name: string; phone?: string; email?: string }> }))
        : Promise.resolve({ data: [] as Array<{ name: string; phone?: string; email?: string }> }),
    ]);

    // Merge hotels by city (deduplicate by name)
    for (const { city, data } of [...cityHotelResults, ...namedHotelResults]) {
      if (!hotelsByCity.has(city)) hotelsByCity.set(city, []);
      const list = hotelsByCity.get(city)!;
      for (const h of data) {
        if (!list.some((x) => x.name === h.name)) {
          list.push({
            name: h.name,
            starRating: (h as HotelResult & { starRating?: number }).starRating,
            area: (h as HotelResult & { area?: string }).area,
          });
        }
      }
    }

    const blocks: string[] = [];

    for (const [city, hotels] of hotelsByCity.entries()) {
      if (hotels.length === 0) continue;
      blocks.push(`Hotels in ${city} (${hotels.length} available):`);
      hotels.slice(0, 12).forEach((h) => {
        const stars = h.starRating ? ` (${h.starRating}★)` : '';
        const area = h.area ? `, ${h.area}` : '';
        blocks.push(`  • ${h.name}${stars}${area}`);
      });
    }

    if (serviceResult.data.length > 0) {
      blocks.push('Matching services:');
      serviceResult.data.slice(0, 6).forEach((s) => {
        const price = s.defaultSellPrice ?? s.basePrice;
        blocks.push(`  • ${s.name} | ${s.categoryCode}${price ? ` | AED ${price}` : ''}`);
      });
    }

    if (agencyResult.data.length > 0) {
      blocks.push('Matching agencies:');
      agencyResult.data.forEach((a) => {
        const phone = a.phone ? ` | ${a.phone}` : '';
        const email = a.email ? ` | ${a.email}` : '';
        blocks.push(`  • ${a.name}${phone}${email}`);
      });
    }

    if (blocks.length === 0) return '';
    return [
      '━━ CATALOG DATA (verified from database — use exact names) ━━',
      ...blocks,
      '━━ END CATALOG DATA ━━',
    ].join('\n');
  }

  /**
   * Extract destination cities dynamically — no hardcoded city list.
   * 1. Reads existing extractedData for previously-found cities.
   * 2. Parses the message for Title Case words after travel-intent triggers.
   * 3. Handles "X and Y" city conjunctions.
   */
  private extractCitiesFromContext(message: string, current: Record<string, unknown>): string[] {
    // Non-city Title Case words to filter out
    const STOP_WORDS = new Set([
      'I', 'My', 'We', 'He', 'She', 'They', 'Our', 'Your', 'His', 'Her', 'Their',
      'The', 'A', 'An', 'This', 'That', 'These', 'Those', 'It', 'Its',
      'And', 'Or', 'But', 'For', 'On', 'With', 'From', 'To', 'At', 'In', 'Of',
      'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'Being', 'Have', 'Has', 'Had',
      'Do', 'Does', 'Did', 'Will', 'Would', 'Could', 'Should', 'May', 'Might',
      'Hotel', 'Resort', 'Package', 'Tour', 'Travel', 'Visa', 'Transfer',
    ]);

    const seen = new Set<string>();
    const addCity = (raw: string) => {
      const c = raw.trim()
        .replace(/\s+(?:for|on|from|and|or|but|with|to|in|at|of|the|a|an)[\s,.].*$/i, '')
        .replace(/[,.]$/, '')
        .trim();
      if (c.length >= 2 && c.length <= 35 && /^[A-Z]/.test(c) && !STOP_WORDS.has(c)) {
        seen.add(c);
      }
    };

    // 1. From current extractedData (most reliable — already parsed)
    const dest = current.destination as string | undefined;
    if (dest) dest.split(',').map((c) => c.trim()).filter(Boolean).forEach(addCity);

    const destinations = current.destinations as Array<{ city?: string }> | undefined;
    if (Array.isArray(destinations)) destinations.forEach((d) => d.city && addCity(d.city));

    const hotels = current.hotels as Array<{ city?: string }> | undefined;
    if (Array.isArray(hotels)) hotels.forEach((h) => h.city && addCity(h.city));

    // 2. Dynamic extraction: Title Case words after travel-intent triggers
    // Lazy quantifier so it stops at the first break
    const intentPattern =
      /\b(?:to|in|at|visit(?:ing)?|travel(?:l?ing)?\s+to|going\s+to|fly(?:ing)?\s+to|stay(?:ing)?\s+in|hotel\s+in|nights?\s+in|days?\s+in|stopp?(?:ing)?\s+in|arriv(?:e|ing)\s+in|based\s+in|plan(?:ning)?\s+to\s+go\s+to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/gi;
    let m: RegExpExecArray | null;
    while ((m = intentPattern.exec(message)) !== null) addCity(m[1]);

    // 3. "X and Y" conjunctions — picks up second city in "Dubai and Doha"
    const andPattern = /\band\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/g;
    while ((m = andPattern.exec(message)) !== null) addCity(m[1]);

    // Default only if nothing extracted at all
    if (seen.size === 0) seen.add('Dubai');
    return [...seen].slice(0, 6);
  }

  /** Extract likely hotel name fragments from a message (for targeted DB search). */
  private extractHotelNameKeywords(message: string): string[] {
    const names: string[] = [];
    // "[Name] Hotel/Resort/Palace/Inn…"
    const pat1 = /([A-Z][A-Za-z\s&']{3,40}?)\s+(?:hotel|resort|palace|inn|suites?|apartments?|towers?|properties)\b/gi;
    // "at/stay at [Name]"
    const pat2 = /\b(?:at|stay(?:ing)?\s+at|hotel\s+is|booked?|book)\s+([A-Z][A-Za-z\s&']{3,40})/g;
    let m: RegExpExecArray | null;
    while ((m = pat1.exec(message)) !== null) names.push(m[1].trim());
    while ((m = pat2.exec(message)) !== null) names.push(m[1].trim());
    return [...new Set(names)].slice(0, 3);
  }

  /** Extract service-related keywords from a lowercased message. */
  private extractServiceKeywords(lower: string): string[] {
    const SERVICE_KW = [
      'airport transfer', 'transfer', 'visa', 'desert safari', 'safari',
      'dhow cruise', 'cruise', 'city tour', 'tour', 'skydiving', 'helicopter',
      'yacht', 'aquaventure', 'ferrari world', 'burj khalifa', 'global village',
      'hot air balloon', 'balloon', 'warner bros', 'img worlds',
    ];
    // Longest match wins (prevents 'safari' stealing 'desert safari')
    return SERVICE_KW.filter((kw) => lower.includes(kw)).slice(0, 3);
  }

  /**
   * Extract an agency/company name from the message text.
   * Handles patterns: "booking by D&D Travels", "from Acme Tourism",
   * "D&D Travels", "agency is XYZ".
   * Returns the FULL agency name including Travel/Travels/Tourism suffix.
   */
  private extractAgencyKeyword(message: string): string | null {
    const SUFFIX = '(?:travels?|tourism|agency|agencies|tours?|holidays?|international|pvt\\.?\\s*ltd\\.?)';

    const patterns: RegExp[] = [
      // "booking/enquiry/request by [Name] Travels"
      new RegExp(`\\b(?:booking|enquiry|inquiry|request)\\s+by\\s+([A-Z][A-Za-z0-9\\s&'.,]{1,40}?\\s+${SUFFIX})\\b`, 'i'),
      // "[Name] Travels/Tourism/Agency/Tours" anywhere
      new RegExp(`\\b([A-Z][A-Za-z0-9\\s&'.,]{1,40}?\\s+${SUFFIX})\\b`, 'i'),
      // "from/via/through/by [Name]"
      /\b(?:from|via|through|by)\s+([A-Z][A-Za-z0-9\s&'.,]{2,50})/i,
      // "agency/company is [Name]"
      /\b(?:agency|company|operator|firm)\s+(?:is\s+)?:?\s*([A-Z][A-Za-z0-9\s&'.,]{2,50})/i,
    ];

    for (const pat of patterns) {
      const m = pat.exec(message);
      if (m) {
        const name = m[1].trim().replace(/[,.]$/, '').trim();
        if (name.length >= 2) return name;
      }
    }
    return null;
  }

  // ── Tool-calling loop (kept for future use with models that support it) ───

  /**
   * Define the tools the AI can call during lead intake.
   * Each tool fetches real data from the database so the AI has verified names/prices.
   */
  private getIntakeTools(): import('./providers/ai-provider.interface').ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'search_hotels',
          description:
            'Search the hotel catalog for real hotels. Use when the user mentions a hotel name or wants a hotel in a city. ' +
            'Returns up to 5 real hotels with their actual catalog names, star ratings, and locations. ' +
            'Always call this before putting a hotel name in extractedData so you use the real catalog name.',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City name (e.g. Dubai, Abu Dhabi, Doha)' },
              name: { type: 'string', description: 'Hotel name to search — supports partial/misspelled names' },
              star_rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Filter by star rating' },
            },
            required: ['city'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_services',
          description:
            'Search the service catalog for real services (transfers, visas, tours, activities, meals, etc.). ' +
            'Returns real service names with pricing type (PRIVATE or SHARED), capacity, and base price per unit. ' +
            'Always call this when the user mentions a service so you have real pricing.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Service name or type to search (e.g. Desert Safari, Airport Transfer, UAE Visa)' },
              destination: { type: 'string', description: 'Destination city to filter services' },
            },
            required: ['name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_agencies',
          description:
            'Search for a travel agency by name. Use when the user mentions a travel agency or company. ' +
            'Returns agency name, phone, and email so you can auto-fill the lead contact details.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Agency or company name to search' },
            },
            required: ['name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate_trip_cost',
          description:
            'Calculate the total trip cost per person given hotels and services. ' +
            'Returns per-person cost for each hotel option and total package price. ' +
            'Use this when you have enough data to show the client a price estimate.',
          parameters: {
            type: 'object',
            properties: {
              pax: { type: 'integer', minimum: 1, description: 'Total number of passengers (adults + children)' },
              hotels: {
                type: 'array',
                description: 'List of hotel options',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    pricePerNight: { type: 'number', description: 'AED per room per night' },
                    nights: { type: 'integer' },
                    roomCount: { type: 'integer' },
                    starRating: { type: 'integer' },
                  },
                },
              },
              services: {
                type: 'array',
                description: 'List of services',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    basePricePerUnit: { type: 'number', description: 'AED per unit' },
                    pricingType: { type: 'string', enum: ['PRIVATE', 'SHARED'] },
                    capacity: { type: 'integer', description: 'Pax per unit for SHARED services' },
                  },
                },
              },
            },
            required: ['pax'],
          },
        },
      },
    ];
  }

  /** Execute a tool call and return the result as a JSON string. */
  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    actor: AuthenticatedUser,
    primaryCity: string,
  ): Promise<string> {
    try {
      switch (name) {
        case 'search_hotels': {
          const city = (args.city as string | undefined) ?? primaryCity;
          const starRating = args.star_rating as number | undefined;
          const searchName = args.name as string | undefined;
          const isGeneric = !searchName || /\d[\s-]*star/i.test(searchName) || /hotel\s+option/i.test(searchName);
          const results = await this.hotelsService.findAll(
            Object.assign(Object.create(null), {
              city, starRating: starRating ? Math.round(starRating) as 3 | 4 | 5 : undefined,
              search: isGeneric ? undefined : searchName,
              limit: 20, page: 1, sortOrder: 'desc',
            }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
          );
          const hotels = results.data.slice(0, 5).map((h) => ({
            name: h.name,
            starRating: 'starRating' in h ? h.starRating : starRating,
            city: 'city' in h ? h.city : city,
            area: 'area' in h ? h.area : undefined,
          }));
          // If name was given and no exact matches, try fuzzy
          if (searchName && !isGeneric && hotels.length < 3) {
            const all = await this.hotelsService.findAll(
              Object.assign(Object.create(null), { city, starRating: starRating ? Math.round(starRating) as 3 | 4 | 5 : undefined, limit: 50, page: 1, sortOrder: 'desc' }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            const fuzzy = this.fuzzyHotelMatch(searchName, all.data);
            if (fuzzy && !hotels.some((h) => h.name === fuzzy.name)) {
              hotels.unshift({ name: fuzzy.name, starRating: 'starRating' in fuzzy ? fuzzy.starRating : starRating, city: 'city' in fuzzy ? fuzzy.city : city, area: undefined });
            }
          }
          return JSON.stringify(hotels.length > 0 ? hotels : [{ message: 'No hotels found', city, starRating }]);
        }

        case 'search_services': {
          const searchName = args.name as string;
          const destination = (args.destination as string | undefined) ?? primaryCity;
          const results = await this.servicesService.findAll(
            Object.assign(Object.create(null), {
              search: searchName, destination, isActive: 'true', limit: 5, page: 1, sortOrder: 'desc',
            }) as import('../service-catalog/dto/query-service.dto').QueryServiceDto,
            actor,
          );
          const services = results.data.map((s) => ({
            id: s.id as string,
            name: s.name,
            categoryCode: s.categoryCode,
            pricingType: 'PRIVATE', // default — can be overridden by catalog field if exists
            basePricePerUnit: s.defaultSellPrice ?? s.basePrice,
            currency: s.currency,
            supplier: s.supplier,
          }));
          return JSON.stringify(services.length > 0 ? services : [{ message: 'No matching services found', searched: searchName }]);
        }

        case 'search_agencies': {
          const searchName = args.name as string;
          const results = await this.agenciesService.findAll(
            Object.assign(Object.create(null), { search: searchName, limit: 5, page: 1, sortOrder: 'asc' }) as import('../agencies/dto/query-agency.dto').QueryAgencyDto,
            actor,
          );
          const agencies = results.data.map((a) => ({
            id: a.id as string,
            name: a.name,
            phone: a.phone,
            email: a.email,
            contactPerson: a.contactPerson,
            city: a.city,
          }));
          return JSON.stringify(agencies.length > 0 ? agencies : [{ message: 'Agency not found', searched: searchName, hint: 'Will be created automatically when lead is saved' }]);
        }

        case 'calculate_trip_cost': {
          const pax = Math.max(1, (args.pax as number) || 1);
          const hotels = (args.hotels as Array<Record<string, unknown>> | undefined) ?? [];
          const services = (args.services as Array<Record<string, unknown>> | undefined) ?? [];

          const servicesCostPerPax = services.reduce((sum, s) => {
            const base = (s.basePricePerUnit as number) ?? 0;
            if (!base) return sum;
            if (s.pricingType === 'SHARED') {
              const cap = Math.max(1, (s.capacity as number) ?? 1);
              const units = Math.ceil(pax / cap);
              return sum + (units * base) / pax;
            }
            return sum + base; // PRIVATE
          }, 0);

          const hotelResults = hotels.map((h) => {
            const ppn = (h.pricePerNight as number) ?? 0;
            const nights = Math.max(1, (h.nights as number) ?? 1);
            const rooms = Math.max(1, (h.roomCount as number) ?? 1);
            const totalAed = ppn * nights * rooms;
            const hotelPerPax = pax > 0 ? totalAed / pax : 0;
            return {
              name: h.name as string,
              pricePerNight: ppn,
              nights,
              rooms,
              totalHotelAed: Math.round(totalAed),
              hotelPerPax: Math.round(hotelPerPax),
              servicesCostPerPax: Math.round(servicesCostPerPax),
              totalPerPax: Math.round(hotelPerPax + servicesCostPerPax),
              totalAed: Math.round((hotelPerPax + servicesCostPerPax) * pax),
            };
          });
          return JSON.stringify({ pax, hotelResults, servicesCostPerPax: Math.round(servicesCostPerPax) });
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }

  /**
   * Tool-calling loop — kept for reference, not called in the current RAG-based flow.
   * @ts-ignore TS6133
   */
  // @ts-ignore
  private async _runToolLoop(
    messages: ChatMessage[],
    actor: AuthenticatedUser,
    primaryCity: string,
    options: ChatOptions,
  ): Promise<string> {
    if (!this.provider.chatWithTools) {
      // Provider doesn't support tools — fall back to plain chat
      return this.provider.chat(messages, options);
    }

    const tools = this.getIntakeTools();
    const loop: ChatMessage[] = [...messages];
    const MAX_ROUNDS = 6;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const result = await this.provider.chatWithTools(loop, tools, options);

      if (result.toolCalls.length === 0) {
        // No more tool calls — AI returned the final response
        return result.content ?? '';
      }

      // Append the AI's message (with tool_calls) to the loop
      loop.push(result.rawMessage as ChatMessage);

      // Execute all tool calls in parallel and append results
      const toolResults = await Promise.all(
        result.toolCalls.map(async (tc) => {
          const toolResult = await this.executeTool(tc.name, tc.arguments, actor, primaryCity);
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            name: tc.name,
            content: toolResult,
          };
        }),
      );
      loop.push(...toolResults);
    }

    // Exceeded max rounds — do a final call without tools to force a JSON response
    return this.provider.chat(loop, options);
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

  async generateQuote(
    dto: import('./dto/generate-quote.dto').GenerateQuoteDto,
    actor: AuthenticatedUser,
  ): Promise<import('./dto/generate-quote.dto').GenerateQuoteResult> {
    const templatePrompt = await this.brain.getPrompt(actor, 'whatsapp_quote_template');
    const currency = dto.currency ?? 'AED';
    const markup = dto.markup ?? 0;
    const validityHours = dto.validityHours ?? 48;
    const travelers = dto.travelers;
    const services = dto.services ?? [];

    // Deterministic pricing: services cost per person (shared across all hotel options)
    const servicesPerPerson = services.reduce((sum, svc) => {
      if (svc.pricePerPerson != null) return sum + svc.pricePerPerson;
      if (!svc.basePricePerUnit) return sum;
      if (svc.pricingType === 'SHARED') {
        const cap = svc.capacity ?? 1;
        const units = Math.ceil(travelers / cap);
        return sum + (units * svc.basePricePerUnit) / travelers;
      }
      return sum + svc.basePricePerUnit;
    }, 0);

    // Pricing per hotel option
    const hotelPricing: import('./dto/generate-quote.dto').QuoteHotelResult[] = dto.hotels.map((h) => {
      const nights = h.nights ?? 1;
      const rooms = h.rooms ?? 1;
      let hotelPerPerson: number;
      if (h.pricePerPerson != null) {
        hotelPerPerson = h.pricePerPerson;
      } else if (h.pricePerNight != null) {
        hotelPerPerson = (h.pricePerNight * rooms * nights) / travelers;
      } else {
        // auto-price from hash + stars
        const stars = h.stars ?? 4;
        const ranges: Record<number, [number, number]> = {
          5: [800, 1200], 4: [400, 700], 3: [200, 350], 2: [100, 200], 1: [60, 100],
        };
        const [min, max] = ranges[Math.round(stars)] ?? [200, 400];
        let hash = 0;
        for (let i = 0; i < h.name.length; i++) hash = (hash * 31 + h.name.charCodeAt(i)) & 0xffffffff;
        const pricePerNight = min + (Math.abs(hash) % (max - min + 1));
        hotelPerPerson = (pricePerNight * rooms * nights) / travelers;
      }
      const base = hotelPerPerson + servicesPerPerson;
      const withMarkup = markup > 0 ? base * (1 + markup / 100) : base;
      const totalPerPerson = Math.round(withMarkup);
      return {
        name: h.name,
        stars: h.stars,
        location: h.location,
        roomType: h.roomType,
        nights,
        rooms,
        basePricePerPerson: Math.round(hotelPerPerson),
        servicesPricePerPerson: Math.round(servicesPerPerson),
        totalPricePerPerson: totalPerPerson,
        totalPrice: totalPerPerson * travelers,
        currency,
      };
    });

    // Format dates
    const formatDate = (d?: string) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    const dateRange = dto.startDate
      ? `${formatDate(dto.startDate)}${dto.endDate ? `–${formatDate(dto.endDate)}` : ''}`
      : '';

    const serviceNames = services.map((s) => s.name);

    const defaultTemplate = `You are generating a WhatsApp quote message for a DMC package. Follow this EXACT format (use WhatsApp bold with *text*, emojis, no HTML):

*{DESTINATION} Package{DATE_RANGE}*
For: {CUSTOMER_NAME}{COMPANY}

{HOTEL_OPTIONS}
*Includes:* {SERVICES}

⚠️ {VALIDITY} hours validity · Non refundable · Subject to availability

To confirm: names + passports
— {BRAND_NAME}{AGENT}`;

    const systemMsg = templatePrompt?.trim()
      ? `${templatePrompt}\n\nAlso follow these format rules: use WhatsApp bold (*text*), emojis (📍, ⭐, ✅, ⚠️), no HTML. Each hotel is a numbered option with name, stars, location, room type, and price per person.`
      : defaultTemplate;

    const hotelLines = hotelPricing
      .map(
        (h, i) =>
          `${i + 1}. ${h.name}${h.stars ? ` (${h.stars}★)` : ''}${h.location ? `\n   📍 ${h.location}` : ''}${h.roomType ? `\n   ${h.roomType}` : ''}\n   ${currency} ${h.totalPricePerPerson.toLocaleString()}/person`,
      )
      .join('\n\n');

    const prompt = [
      `Generate a WhatsApp quote message for this DMC package:`,
      `Destination: ${dto.destination}`,
      `Dates: ${dateRange || 'TBD'}`,
      `Travelers: ${travelers} (${dto.adults ?? travelers} adults${dto.children ? `, ${dto.children} children` : ''})`,
      `Customer: ${dto.customerName}${dto.companyName ? ` (${dto.companyName})` : ''}`,
      `Hotel options and pricing (${currency}):`,
      hotelLines,
      serviceNames.length > 0 ? `Included services: ${serviceNames.join(', ')}` : '',
      `Quote validity: ${validityHours} hours`,
      `DMC Brand: ${dto.brandName ?? 'Easy Go Venture Tourism'}`,
      dto.agentName ? `Agent: ${dto.agentName}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.provider.chat(
      [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.3, maxTokens: 800 },
    );

    return { message: raw.trim(), hotelPricing, currency, validityHours };
  }

  private async enrichExtractedData(
    data: LeadIntakeChatResponse['extractedData'],
    actor: AuthenticatedUser,
  ): Promise<LeadIntakeChatResponse['extractedData']> {
    const destination = data.destination ?? 'Dubai';
    const primaryCity = destination.split(',')[0].trim();

    // Enrich hotels: generic placeholders get replaced with a real catalog hotel;
    // named hotels are only replaced when a confident fuzzy match is found (≥0.35).
    if (data.hotels?.length) {
      const usedNames = new Set<string>();
      const enriched: typeof data.hotels = [];
      for (const h of data.hotels) {
        try {
          const city = h.city ?? primaryCity;
          const starRating = h.rating ? (Math.round(h.rating) as 3 | 4 | 5) : undefined;
          const isGenericName = !h.name ||
            /\d[\s-]*star/i.test(h.name) ||
            /hotel\s+(option|night)\s*\d*/i.test(h.name) ||
            /^(5|4|3)-?star hotel/i.test(h.name);

          if (isGenericName) {
            // Generic placeholder — assign the first available distinct catalog hotel
            const results = await this.hotelsService.findAll(
              Object.assign(Object.create(null), {
                city, starRating, limit: 20, page: 1, sortOrder: 'desc',
              }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            const match = results.data.find((r) => !usedNames.has(r.name.toLowerCase())) ?? results.data[0];
            if (match) {
              usedNames.add(match.name.toLowerCase());
              enriched.push({
                ...h,
                name: match.name,
                rating: 'starRating' in match ? match.starRating : (h.rating ?? 4),
                city: 'city' in match ? match.city : city,
              });
              continue;
            }
          } else {
            // Named hotel — search by name first, then fuzzy across city
            const searchResults = await this.hotelsService.findAll(
              Object.assign(Object.create(null), {
                city, starRating, search: h.name, limit: 10, page: 1, sortOrder: 'desc',
              }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            const confirmedFromSearch = this.fuzzyHotelMatch(
              h.name!,
              searchResults.data.filter((r) => !usedNames.has(r.name.toLowerCase())),
            );
            if (confirmedFromSearch) {
              usedNames.add(confirmedFromSearch.name.toLowerCase());
              enriched.push({
                ...h,
                name: confirmedFromSearch.name,
                rating: 'starRating' in confirmedFromSearch ? confirmedFromSearch.starRating : (h.rating ?? 4),
                city: 'city' in confirmedFromSearch ? confirmedFromSearch.city : city,
              });
              continue;
            }
            // Fuzzy fallback across all city hotels
            const allResults = await this.hotelsService.findAll(
              Object.assign(Object.create(null), {
                city, starRating, limit: 60, page: 1, sortOrder: 'desc',
              }) as import('../hotels/dto/query-hotel.dto').QueryHotelDto,
            );
            const fuzzy = this.fuzzyHotelMatch(
              h.name!,
              allResults.data.filter((r) => !usedNames.has(r.name.toLowerCase())),
            );
            if (fuzzy) {
              usedNames.add(fuzzy.name.toLowerCase());
              enriched.push({
                ...h,
                name: fuzzy.name,
                rating: 'starRating' in fuzzy ? fuzzy.starRating : (h.rating ?? 4),
                city: 'city' in fuzzy ? fuzzy.city : city,
              });
              continue;
            }
            // No catalog match — keep the name exactly as the operator typed it
          }
        } catch {
          // DB unavailable — return as-is
        }
        if (h.name) usedNames.add(h.name.toLowerCase());
        enriched.push(h);
      }
      data.hotels = enriched;
    }

    // Enrich services: get real pricing from catalog
    if (data.services?.length) {
      data.services = await Promise.all(
        data.services.map(async (s) => {
          if (!s.name) return s;
          try {
            const results = await this.servicesService.findAll(
              Object.assign(Object.create(null), { search: s.name, destination: primaryCity, isActive: 'true', limit: 1, page: 1, sortOrder: 'desc' }) as import('../service-catalog/dto/query-service.dto').QueryServiceDto,
              actor,
            );
            const match = results.data[0];
            if (match) {
              const price = match.defaultSellPrice ?? match.basePrice;
              return {
                ...s,
                name: match.name,
                basePricePerUnit: price != null ? price : s.basePricePerUnit,
                currency: match.currency ?? s.currency ?? 'AED',
              };
            }

            // Auto-create the service in the catalog
            try {
              const categoryCode = this.inferServiceCategory(s.name ?? '', s.serviceType ?? '');
              const created = await this.servicesService.create(
                Object.assign(Object.create(null), {
                  name: s.name!,
                  categoryCode,
                  destination: primaryCity,
                  currency: s.currency ?? 'AED',
                  basePrice: s.basePricePerUnit != null ? s.basePricePerUnit : undefined,
                  defaultSellPrice: s.basePricePerUnit != null ? s.basePricePerUnit : undefined,
                  isActive: true,
                  serviceType: s.serviceType ?? undefined,
                }) as import('../service-catalog/dto/create-service.dto').CreateServiceDto,
                actor,
              );
              return { ...s, serviceId: created.id as string, name: created.name };
            } catch {
              // Auto-create failed — return as-is
            }
          } catch {
            // DB unavailable — return as-is
          }
          return s;
        }),
      );
    }

    return data;
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

  /** Tokenize a hotel name into meaningful words (≥3 chars, alphanumeric). */
  private tokenize(s: string): Set<string> {
    return new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3),
    );
  }

  /**
   * Fuzzy-match a typed hotel name against a list of catalog hotels.
   * Uses Jaccard word-overlap so "Palm Jumierah" still matches "Palm Jumeirah".
   * Returns the best match only if score ≥ 0.35.
   */
  private fuzzyHotelMatch(query: string, candidates: HotelResult[]): HotelResult | null {
    if (!query || !candidates.length) return null;
    const qTokens = this.tokenize(query);
    if (qTokens.size === 0) return null;

    let bestScore = 0;
    let bestMatch: HotelResult | null = null;

    for (const hotel of candidates) {
      const hTokens = this.tokenize(hotel.name);
      if (hTokens.size === 0) continue;
      const intersection = [...qTokens].filter((t) => hTokens.has(t)).length;
      const union = new Set([...qTokens, ...hTokens]).size;
      const score = intersection / union;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = hotel;
      }
    }

    return bestScore >= 0.35 ? bestMatch : null;
  }

  /** Infer a service catalog category code from the service name/type keywords. */
  private inferServiceCategory(name: string, serviceType: string): string {
    const text = `${name} ${serviceType}`.toLowerCase();
    if (/visa/.test(text)) return 'VISA';
    if (/transfer|taxi|car|bus|coach|sedan|van|shuttle|pickup/.test(text)) return 'TRANSFER';
    if (/safari|dhow|cruise|yacht|boat|sightseeing|tour|museum|city|heritage/.test(text)) return 'SIGHTSEEING';
    if (/skydiving|balloon|helicopter|aqua|waterpark|theme|park|zip|adventure|atv|quad/.test(text)) return 'ACTIVITY';
    if (/meal|breakfast|lunch|dinner|restaurant|board|food/.test(text)) return 'MEAL';
    if (/hotel|accommodation|stay|resort|villa|apartment/.test(text)) return 'ACCOMMODATION';
    if (/insurance/.test(text)) return 'INSURANCE';
    return 'OTHER';
  }
}
